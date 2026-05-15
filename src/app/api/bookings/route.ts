import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { sendSms } from '@/lib/esms';

// GET /api/bookings — list bookings for the salon
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sp = request.nextUrl.searchParams;
    const staffId = sp.get('staff_id');
    const status  = sp.get('status');       // pending, confirmed, completed, cancelled, no_show
    const upcoming = sp.get('upcoming') === 'true';

    // date_from / date_to support ranges; legacy 'date' param = single-day shorthand
    const legacyDate = sp.get('date') === 'today'
      ? new Date().toISOString().split('T')[0]
      : sp.get('date');
    const dateFrom = sp.get('date_from') ?? legacyDate;
    const dateTo   = sp.get('date_to')   ?? dateFrom;

    const rows = await sql`
      SELECT
        b.*,
        s.name              AS service_name,
        s.duration_minutes  AS service_duration,
        s.price             AS service_price,
        st.name             AS staff_name,
        c.name              AS client_name,
        c.phone             AS client_phone
      FROM bookings b
      LEFT JOIN services  s  ON s.id  = b.service_id
      LEFT JOIN workers   st ON st.id = b.staff_id
      LEFT JOIN clients   c  ON c.id  = b.client_id
      WHERE b.salon_id = ${user.salon_id}
        AND (${dateFrom}::date IS NULL OR b.booking_date BETWEEN ${dateFrom}::date AND ${dateTo}::date)
        AND (${staffId}::uuid  IS NULL OR b.staff_id = ${staffId}::uuid)
        AND (${status}::text   IS NULL OR b.status   = ${status}::text)
        AND (NOT ${upcoming} OR (b.booking_date > CURRENT_DATE)
             OR (b.booking_date = CURRENT_DATE AND b.start_time >= CURRENT_TIME))
      ORDER BY b.booking_date ASC, b.start_time ASC
    `;

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Bookings GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/bookings — create a new booking
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
      client_id,
      guest_name,
      guest_phone,
      staff_id,
      service_id,
      booking_date,
      start_time,
      notes,
    } = body;

    // Validate required fields
    if (!staff_id || !service_id || !booking_date || !start_time) {
      return NextResponse.json(
        { error: 'staff_id, service_id, booking_date and start_time are required' },
        { status: 400 }
      );
    }

    if (!client_id && !guest_name) {
      return NextResponse.json(
        { error: 'Either client_id or guest_name is required' },
        { status: 400 }
      );
    }

    // Fetch service for duration
    const [service] = await sql`
      SELECT id, name, duration_minutes, price FROM services
      WHERE id = ${service_id} AND salon_id = ${user.salon_id} AND is_active = true
    `;
    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    // Fetch booking settings for buffer
    const [settings] = await sql`
      SELECT buffer_minutes FROM booking_settings WHERE salon_id = ${user.salon_id}
    `;
    const bufferMins = settings?.buffer_minutes ?? 15;

    // Calculate end_time
    const [hours, minutes] = start_time.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + service.duration_minutes;
    const end_time = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

    // Check for conflicts (existing bookings that overlap including buffer)
    const [conflict] = await sql`
      SELECT id FROM bookings
      WHERE staff_id = ${staff_id}
        AND booking_date = ${booking_date}
        AND status NOT IN ('cancelled', 'no_show')
        AND (
          (start_time < (${end_time}::time + (${bufferMins} || ' minutes')::interval)
            AND end_time > (${start_time}::time - (${bufferMins} || ' minutes')::interval))
        )
    `;
    if (conflict) {
      return NextResponse.json(
        { error: 'This time slot is already booked. Please choose a different time.' },
        { status: 409 }
      );
    }

    // Create booking
    const [booking] = await sql`
      INSERT INTO bookings
        (salon_id, client_id, guest_name, guest_phone, staff_id, service_id,
         booking_date, start_time, end_time, notes, status)
      VALUES
        (${user.salon_id}, ${client_id ?? null}, ${guest_name ?? null},
         ${guest_phone ?? null}, ${staff_id}, ${service_id},
         ${booking_date}, ${start_time}, ${end_time}, ${notes ?? null}, 'pending')
      RETURNING *
    `;

    // Send SMS confirmation
    const phone = guest_phone ?? null;
    if (phone) {
      try {
        const msg = `Hi ${guest_name ?? 'there'}! Your booking for ${service.name} on ${booking_date} at ${start_time} has been received. We'll confirm shortly.`;
        await sendSms({ to: phone, text: msg });
      } catch {
        // Non-blocking — booking already saved
      }
    } else if (client_id) {
      const [client] = await sql`SELECT name, phone FROM clients WHERE id = ${client_id}`;
      if (client?.phone) {
        try {
          const msg = `Hi ${client.name}! Your booking for ${service.name} on ${booking_date} at ${start_time} has been received.`;
          await sendSms({ to: client.phone, text: msg });
        } catch {
          // Non-blocking
        }
      }
    }

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error('Bookings POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
