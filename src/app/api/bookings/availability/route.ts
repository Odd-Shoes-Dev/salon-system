import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/bookings/availability?date=YYYY-MM-DD&service_id=...&staff_id=...
// Returns available time slots for a given date + service (+ optional staff)
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sp = request.nextUrl.searchParams;
    const date = sp.get('date');
    const serviceId = sp.get('service_id');
    const staffId = sp.get('staff_id'); // optional filter to one staff

    if (!date || !serviceId) {
      return NextResponse.json({ error: 'date and service_id are required' }, { status: 400 });
    }

    // Fetch service duration
    const [service] = await sql`
      SELECT id, name, duration_minutes FROM services
      WHERE id = ${serviceId} AND salon_id = ${user.salon_id} AND is_active = true
    `;
    if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 });

    // Fetch booking settings
    const [settings] = await sql`
      SELECT * FROM booking_settings WHERE salon_id = ${user.salon_id}
    `;
    const bufferMins: number = settings?.buffer_minutes ?? 15;
    const slotInterval: number = settings?.slot_interval_minutes ?? 30; // step between displayed slots
    const serviceDuration: number = service.duration_minutes;            // used only for conflict window

    // day_of_week: JS Date.getDay() — 0=Sunday, 6=Saturday
    // Parse as local date, not UTC
    const [y, m, d] = date.split('-').map(Number);
    const dayOfWeek = new Date(y, m - 1, d).getDay();

    // Fetch staff with their schedule for this day
    const staffRows = await sql`
      SELECT
        st.id AS staff_id, st.name AS staff_name,
        sch.start_time, sch.end_time, sch.is_available
      FROM workers st
      LEFT JOIN staff_schedules sch
        ON sch.staff_id = st.id AND sch.day_of_week = ${dayOfWeek}
      WHERE st.salon_id = ${user.salon_id}
        AND st.is_active = true
        AND (${staffId}::uuid IS NULL OR st.id = ${staffId}::uuid)
    `;

    // Fetch existing bookings on this date
    const existingBookings = await sql`
      SELECT staff_id, start_time, end_time FROM bookings
      WHERE salon_id = ${user.salon_id}
        AND booking_date = ${date}
        AND status NOT IN ('cancelled', 'no_show')
    `;

    // Use fallback working hours if no staff schedule set
    const fallbackStart = settings?.working_hours_start ?? '07:00';
    const fallbackEnd   = settings?.working_hours_end   ?? '23:00';

    const results: {
      staff_id: string;
      staff_name: string;
      slots: string[];
    }[] = [];

    for (const st of staffRows) {
      // Skip staff not working today
      if (st.is_available === false) continue;

      const startStr: string = st.start_time ?? fallbackStart;
      const endStr: string   = st.end_time   ?? fallbackEnd;

      const [sh, sm] = startStr.split(':').map(Number);
      const [eh, em] = endStr.split(':').map(Number);
      const dayStartMin = sh * 60 + sm;
      const dayEndMin   = eh * 60 + em;

      // Bookings for this staff on this date
      const staffBookings = (existingBookings as Array<{ staff_id: string; start_time: string; end_time: string }>)
        .filter(b => b.staff_id === st.staff_id)
        .map(b => {
          const [bsh, bsm] = b.start_time.split(':').map(Number);
          const [beh, bem] = b.end_time.split(':').map(Number);
          return { start: bsh * 60 + bsm, end: beh * 60 + bem };
        });

      const slots: string[] = [];
      const now = new Date();
      const isToday = date === now.toISOString().split('T')[0];
      const currentMin = isToday ? now.getHours() * 60 + now.getMinutes() : 0;
      const minAdvance = settings?.min_advance_minutes ?? 60;

      let cursor = dayStartMin;
      while (cursor + serviceDuration <= dayEndMin) {
        const slotEnd = cursor + serviceDuration;

        // Skip past slots (with minimum advance buffer)
        if (isToday && cursor < currentMin + minAdvance) {
          cursor += slotInterval;
          continue;
        }

        // Check overlap: would this slot (start → start+duration) clash with an existing booking?
        const hasConflict = staffBookings.some(
          b => cursor < b.end + bufferMins && slotEnd > b.start - bufferMins
        );

        if (!hasConflict) {
          const hh = String(Math.floor(cursor / 60)).padStart(2, '0');
          const mm = String(cursor % 60).padStart(2, '0');
          slots.push(`${hh}:${mm}`);
        }

        cursor += slotInterval;
      }

      results.push({ staff_id: st.staff_id, staff_name: st.staff_name, slots });
    }

    return NextResponse.json({
      date,
      service_id: serviceId,
      duration_minutes: service.duration_minutes,
      buffer_minutes: bufferMins,
      staff_availability: results,
    });
  } catch (error) {
    console.error('Availability GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
