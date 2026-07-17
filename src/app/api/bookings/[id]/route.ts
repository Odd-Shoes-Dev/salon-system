import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { smsProvider } from '@/lib/sms';

// GET /api/bookings/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const [booking] = await sql`
      SELECT
        b.*, TO_CHAR(b.booking_date, 'YYYY-MM-DD') AS booking_date,
        s.name             AS service_name,
        s.duration_minutes AS service_duration,
        s.price            AS service_price,
        st.name            AS staff_name,
        c.name             AS client_name,
        c.phone            AS client_phone
      FROM bookings b
      LEFT JOIN services  s  ON s.id  = b.service_id
      LEFT JOIN workers   st ON st.id = b.staff_id
      LEFT JOIN clients   c  ON c.id  = b.client_id
      WHERE b.id = ${id} AND b.salon_id = ${user.salon_id}
    `;

    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    return NextResponse.json(booking);
  } catch (error) {
    console.error('Booking GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/bookings/[id] — update status, reschedule, add notes
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role === 'viewer') {
      return NextResponse.json({ error: 'Viewers cannot modify bookings' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, notes, cancellation_reason, booking_date, start_time } = body;

    // Verify booking belongs to this salon
    const [existing] = await sql`
      SELECT b.*, TO_CHAR(b.booking_date, 'YYYY-MM-DD') AS booking_date,
             s.duration_minutes, s.name AS service_name,
             c.name AS client_name, c.phone AS client_phone,
             st.name AS staff_name
      FROM bookings b
      LEFT JOIN services s ON s.id = b.service_id
      LEFT JOIN clients  c ON c.id = b.client_id
      LEFT JOIN workers  st ON st.id = b.staff_id
      WHERE b.id = ${id} AND b.salon_id = ${user.salon_id}
    `;
    if (!existing) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    // If rescheduling, recalculate end_time and check conflicts
    let newEndTime: string | null = null;
    if (start_time && booking_date) {
      const [h, m] = start_time.split(':').map(Number);
      const endMin = h * 60 + m + existing.duration_minutes;
      newEndTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;

      const [settings] = await sql`SELECT buffer_minutes FROM booking_settings WHERE salon_id = ${user.salon_id}`;
      const bufferMins = settings?.buffer_minutes ?? 15;

      const [conflict] = await sql`
        SELECT id FROM bookings
        WHERE staff_id = ${existing.staff_id}
          AND booking_date = ${booking_date}
          AND id != ${id}
          AND status NOT IN ('cancelled', 'no_show')
          AND (
            start_time < (${newEndTime}::time + (${bufferMins} || ' minutes')::interval)
            AND end_time > (${start_time}::time - (${bufferMins} || ' minutes')::interval)
          )
      `;
      if (conflict) {
        return NextResponse.json(
          { error: 'This time slot is already booked. Please choose a different time.' },
          { status: 409 }
        );
      }
    }

    const [updated] = await sql`
      UPDATE bookings SET
        status              = COALESCE(${status ?? null}::text,                status),
        notes               = COALESCE(${notes ?? null}::text,                 notes),
        cancellation_reason = COALESCE(${cancellation_reason ?? null}::text,   cancellation_reason),
        booking_date        = COALESCE(${booking_date ?? null}::date,          booking_date),
        start_time          = COALESCE(${start_time ?? null}::time,            start_time),
        end_time            = COALESCE(${newEndTime}::time,                    end_time),
        updated_at          = NOW()
      WHERE id = ${id} AND salon_id = ${user.salon_id}
      RETURNING *
    `;

    // Notify client on confirmation or cancellation
    const phone = existing.client_phone ?? existing.guest_phone;
    if (phone && status) {
      try {
        let msg = '';
        const name = existing.client_name ?? existing.guest_name ?? 'there';
        const dateStr = booking_date ?? existing.booking_date;
        const timeStr = start_time ?? existing.start_time;
        if (status === 'confirmed') {
          msg = `Hi ${name}! Your booking for ${existing.service_name} on ${dateStr} at ${timeStr} is confirmed. See you then!`;
        } else if (status === 'cancelled') {
          msg = `Hi ${name}, your booking for ${existing.service_name} on ${dateStr} has been cancelled. Contact us to rebook.`;
        }
        if (msg) await smsProvider.sendMessage(phone, msg);
      } catch {
        // Non-blocking
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Booking PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/bookings/[id] — cancel booking
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Only managers and above can cancel bookings' }, { status: 403 });
    }

    const { id } = await params;
    const { reason } = await request.json().catch(() => ({ reason: null }));

    const [booking] = await sql`
      UPDATE bookings
      SET status = 'cancelled', cancellation_reason = ${reason ?? null}, updated_at = NOW()
      WHERE id = ${id} AND salon_id = ${user.salon_id}
        AND status NOT IN ('completed', 'cancelled')
      RETURNING *
    `;

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found or already cancelled' }, { status: 404 });
    }

    return NextResponse.json({ success: true, booking });
  } catch (error) {
    console.error('Booking DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
