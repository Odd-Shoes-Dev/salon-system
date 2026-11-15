import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// GET /api/workers/[id]/time-off
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const rows = await sql`
      SELECT id, start_date::text, end_date::text, reason, created_at
      FROM staff_time_off
      WHERE staff_id = ${id} AND salon_id = ${user.salon_id}
      ORDER BY start_date DESC
    `;
    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/workers/[id]/time-off error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/workers/[id]/time-off
// Body: { start_date, end_date, reason? }
// Refuses to create the time-off range while a pending/confirmed booking is
// already on the books for this staff member within it — reassigning or
// rescheduling those has to happen first, so nobody's leave silently leaves
// an orphaned appointment nobody's watching.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const { start_date, end_date, reason } = await req.json();

    if (!start_date || !end_date) {
      return NextResponse.json({ error: 'Start and end date are required' }, { status: 400 });
    }
    if (end_date < start_date) {
      return NextResponse.json({ error: 'End date cannot be before start date' }, { status: 400 });
    }

    const [worker] = await sql`
      SELECT id FROM workers WHERE id = ${id} AND salon_id = ${user.salon_id}
    `;
    if (!worker) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });

    const conflicts = await sql`
      SELECT b.booking_number, TO_CHAR(b.booking_date, 'YYYY-MM-DD') AS booking_date,
        b.start_time::text, b.end_time::text,
        COALESCE(c.name, b.guest_name) AS client_name
      FROM bookings b
      LEFT JOIN clients c ON c.id = b.client_id
      WHERE b.salon_id = ${user.salon_id} AND b.staff_id = ${id}
        AND b.status IN ('pending', 'confirmed')
        AND b.booking_date BETWEEN ${start_date}::date AND ${end_date}::date
      ORDER BY b.booking_date ASC, b.start_time ASC
    `;
    if (conflicts.length > 0) {
      return NextResponse.json({
        error: `This staff member has ${conflicts.length} booking${conflicts.length > 1 ? 's' : ''} in that date range — reschedule or reassign them first.`,
        conflicts,
      }, { status: 409 });
    }

    const [row] = await sql`
      INSERT INTO staff_time_off (salon_id, staff_id, start_date, end_date, reason, created_by)
      VALUES (${user.salon_id}, ${id}, ${start_date}, ${end_date}, ${reason?.trim() || null}, ${user.id})
      RETURNING id, start_date::text, end_date::text, reason, created_at
    `;
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error('POST /api/workers/[id]/time-off error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
