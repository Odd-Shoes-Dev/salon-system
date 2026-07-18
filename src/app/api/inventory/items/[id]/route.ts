import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const [item] = await sql`
      SELECT si.*,
        json_build_object('id', sg.id, 'name', sg.name, 'color', sg.color, 'parent_id', sg.parent_id) AS "group",
        json_build_object('id', sup.id, 'name', sup.name) AS supplier
      FROM stock_items si
      LEFT JOIN stock_groups sg  ON sg.id  = si.group_id
      LEFT JOIN suppliers    sup ON sup.id = si.supplier_id
      WHERE si.id = ${id} AND si.salon_id = ${user.salon_id} AND si.deleted_at IS NULL`;

    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const [movements, allocations] = await Promise.all([
      sql`
        SELECT sm.*, s.name AS staff_name
        FROM stock_movements sm
        LEFT JOIN staff s ON s.id = sm.created_by
        WHERE sm.item_id = ${id} AND sm.salon_id = ${user.salon_id}
        ORDER BY sm.created_at DESC`,
      sql`
        SELECT sa.*, w.name AS worker_name, w.job_title, s.name AS allocated_by_name
        FROM stock_allocations sa
        LEFT JOIN workers w ON w.id = sa.worker_id
        LEFT JOIN staff   s ON s.id = sa.allocated_by
        WHERE sa.item_id = ${id} AND sa.salon_id = ${user.salon_id}
        ORDER BY sa.allocated_at DESC`,
    ]);

    const allMovements   = movements as any[];
    const restocks       = allMovements.filter(m => m.reason === 'purchase' && m.qty_change > 0);
    const totalSpent     = restocks.reduce((sum, m) => sum + Number(m.qty_change) * Number(item.cost_per_unit), 0);
    const currentValue   = Number(item.current_qty) * Number(item.cost_per_unit);
    const lastRestockedAt = restocks[0]?.created_at ?? null;

    return NextResponse.json({
      item,
      summary: { totalSpent, currentValue, timesRestocked: restocks.length, lastRestockedAt },
      movements: allMovements,
      allocations,
    });
  } catch (err) {
    console.error('GET /api/inventory/items/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const { name, description, unit, group_id, supplier_id, sku, reorder_level, cost_per_unit, is_active } = await request.json();
    const branchId = user.branch_id;

    await sql`
      UPDATE stock_items SET
        name          = ${name?.trim()},
        description   = ${description?.trim() || null},
        unit          = ${unit},
        group_id      = ${group_id || null},
        supplier_id   = ${supplier_id || null},
        sku           = ${sku?.trim() || null},
        reorder_level = ${Number(reorder_level) || 0},
        cost_per_unit = ${Number(cost_per_unit) || 0},
        is_active     = COALESCE(${is_active ?? null}, is_active),
        updated_at    = NOW()
      WHERE id = ${id} AND salon_id = ${user.salon_id}
        AND (${branchId}::uuid IS NULL OR branch_id = ${branchId}::uuid)`;

    const [data] = await sql`
      SELECT si.*,
        json_build_object('id', sg.id, 'name', sg.name, 'color', sg.color, 'parent_id', sg.parent_id) AS "group",
        json_build_object('id', sup.id, 'name', sup.name) AS supplier
      FROM stock_items si
      LEFT JOIN stock_groups sg  ON sg.id  = si.group_id
      LEFT JOIN suppliers    sup ON sup.id = si.supplier_id
      WHERE si.id = ${id}`;

    if (!data) return NextResponse.json({ error: 'Item not found or not in your branch' }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    console.error('PUT /api/inventory/items/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const branchId = user.branch_id;

    await sql`
      UPDATE stock_items SET deleted_at = NOW(), is_active = false
      WHERE id = ${id} AND salon_id = ${user.salon_id}
        AND (${branchId}::uuid IS NULL OR branch_id = ${branchId}::uuid)`;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/inventory/items/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
