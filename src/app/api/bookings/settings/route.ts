import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/bookings/settings
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [settings] = await sql`
      SELECT * FROM booking_settings WHERE salon_id = ${user.salon_id}
    `;

    // Return defaults if not yet configured
    if (!settings) {
      return NextResponse.json({
        salon_id: user.salon_id,
        is_enabled: false,
        buffer_minutes: 15,
        advance_booking_days: 60,
        min_advance_minutes: 60,
        cancellation_hours: 24,
        working_hours_start: '09:00',
        working_hours_end: '18:00',
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Booking settings GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/bookings/settings — upsert booking settings
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const {
      is_enabled,
      buffer_minutes,
      advance_booking_days,
      min_advance_minutes,
      cancellation_hours,
      working_hours_start,
      working_hours_end,
    } = body;

    const [settings] = await sql`
      INSERT INTO booking_settings
        (salon_id, is_enabled, buffer_minutes, advance_booking_days,
         min_advance_minutes, cancellation_hours, working_hours_start, working_hours_end)
      VALUES
        (${user.salon_id},
         ${is_enabled ?? true},
         ${buffer_minutes ?? 15},
         ${advance_booking_days ?? 60},
         ${min_advance_minutes ?? 60},
         ${cancellation_hours ?? 24},
         ${working_hours_start ?? '09:00'},
         ${working_hours_end ?? '18:00'})
      ON CONFLICT (salon_id) DO UPDATE SET
        is_enabled           = COALESCE(${is_enabled ?? null}::boolean,         booking_settings.is_enabled),
        buffer_minutes       = COALESCE(${buffer_minutes ?? null}::integer,      booking_settings.buffer_minutes),
        advance_booking_days = COALESCE(${advance_booking_days ?? null}::integer, booking_settings.advance_booking_days),
        min_advance_minutes  = COALESCE(${min_advance_minutes ?? null}::integer,  booking_settings.min_advance_minutes),
        cancellation_hours   = COALESCE(${cancellation_hours ?? null}::integer,   booking_settings.cancellation_hours),
        working_hours_start  = COALESCE(${working_hours_start ?? null}::time,     booking_settings.working_hours_start),
        working_hours_end    = COALESCE(${working_hours_end ?? null}::time,       booking_settings.working_hours_end),
        updated_at           = NOW()
      RETURNING *
    `;

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Booking settings PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
