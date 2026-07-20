import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; repairId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { repairId } = await params;
    const { description, repair_date, cost, repaired_by, status, notes } = await req.json();

    const [repair] = await sql`
      UPDATE equipment_repairs SET
        description = ${description?.trim()},
        repair_date = ${repair_date || null},
        cost        = ${cost != null ? Number(cost) : null},
        repaired_by = ${repaired_by?.trim() || null},
        status      = ${status || 'pending'},
        notes       = ${notes?.trim() || null},
        updated_at  = NOW()
      WHERE id = ${repairId} AND salon_id = ${user.salon_id}
      RETURNING *`;

    if (!repair) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(repair);
  } catch (err) {
    console.error('PUT /api/inventory/equipment/[id]/repairs/[repairId] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; repairId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { repairId } = await params;
    await sql`DELETE FROM equipment_repairs WHERE id = ${repairId} AND salon_id = ${user.salon_id}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE repair error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
