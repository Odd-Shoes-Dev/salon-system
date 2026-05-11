import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/bookings/schedules?staff_id=... (optional)
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const staffId = request.nextUrl.searchParams.get('staff_id');

    const rows = await sql`
      SELECT
        sch.*,
        st.name AS staff_name
      FROM staff_schedules sch
      JOIN workers st ON st.id = sch.staff_id
      WHERE sch.salon_id = ${user.salon_id}
        AND (${staffId}::uuid IS NULL OR sch.staff_id = ${staffId}::uuid)
      ORDER BY st.name, sch.day_of_week
    `;

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Staff schedules GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/bookings/schedules — upsert one or many schedule entries
// Body: { staff_id, schedules: [{ day_of_week, start_time, end_time, is_available }] }
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { staff_id, schedules } = body;

    if (!staff_id || !Array.isArray(schedules) || schedules.length === 0) {
      return NextResponse.json({ error: 'staff_id and schedules array are required' }, { status: 400 });
    }

    // Verify worker belongs to this salon
    const [staffRow] = await sql`
      SELECT id FROM workers WHERE id = ${staff_id} AND salon_id = ${user.salon_id}
    `;
    if (!staffRow) return NextResponse.json({ error: 'Worker not found' }, { status: 404 });

    const results = [];
    for (const s of schedules) {
      const { day_of_week, start_time, end_time, is_available = true } = s;
      if (day_of_week === undefined || day_of_week === null) continue;

      const [row] = await sql`
        INSERT INTO staff_schedules (salon_id, staff_id, day_of_week, start_time, end_time, is_available)
        VALUES (${user.salon_id}, ${staff_id}, ${day_of_week}, ${start_time}, ${end_time}, ${is_available})
        ON CONFLICT (staff_id, day_of_week) DO UPDATE SET
          start_time   = EXCLUDED.start_time,
          end_time     = EXCLUDED.end_time,
          is_available = EXCLUDED.is_available,
          updated_at   = NOW()
        RETURNING *
      `;
      results.push(row);
    }

    return NextResponse.json(results, { status: 201 });
  } catch (error) {
    console.error('Staff schedules POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
