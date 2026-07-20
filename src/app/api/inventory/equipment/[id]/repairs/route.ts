import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const repairs = await sql`
      SELECT * FROM equipment_repairs
      WHERE equipment_id = ${id} AND salon_id = ${user.salon_id}
      ORDER BY created_at DESC`;

    return NextResponse.json(repairs);
  } catch (err) {
    console.error('GET /api/inventory/equipment/[id]/repairs error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const { description, repair_date, cost, repaired_by, status, notes } = await req.json();
    if (!description?.trim()) return NextResponse.json({ error: 'Description is required' }, { status: 400 });

    const [repair] = await sql`
      INSERT INTO equipment_repairs (salon_id, equipment_id, description, repair_date, cost, repaired_by, status, notes)
      VALUES (
        ${user.salon_id}, ${id},
        ${description.trim()},
        ${repair_date || null},
        ${cost ? Number(cost) : null},
        ${repaired_by?.trim() || null},
        ${status || 'pending'},
        ${notes?.trim() || null}
      )
      RETURNING *`;

    return NextResponse.json(repair, { status: 201 });
  } catch (err) {
    console.error('POST /api/inventory/equipment/[id]/repairs error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
