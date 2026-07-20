import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const { name, category, serial_number, purchase_date, purchase_cost, condition, notes, is_active, supplier_id } = await req.json();

    const [item] = await sql`
      UPDATE equipment SET
        name          = ${name?.trim()},
        category      = ${category?.trim() || null},
        serial_number = ${serial_number?.trim() || null},
        purchase_date = ${purchase_date || null},
        purchase_cost = ${purchase_cost != null ? Number(purchase_cost) : null},
        condition     = ${condition || 'good'},
        notes         = ${notes?.trim() || null},
        supplier_id   = ${supplier_id || null},
        is_active     = COALESCE(${is_active ?? null}, is_active),
        updated_at    = NOW()
      WHERE id = ${id} AND salon_id = ${user.salon_id} AND deleted_at IS NULL
      RETURNING *`;

    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(item);
  } catch (err) {
    console.error('PUT /api/inventory/equipment/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    await sql`
      UPDATE equipment SET deleted_at = NOW(), is_active = false
      WHERE id = ${id} AND salon_id = ${user.salon_id}`;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/inventory/equipment/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
