import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const itemId   = searchParams.get('item_id');
    const limit    = Number(searchParams.get('limit') || 50);
    const branchId = user.branch_id;

    const data = itemId
      ? await sql`
          SELECT sm.*,
            json_build_object('name', si.name, 'unit', si.unit) AS item,
            json_build_object('name', s.name)                   AS staff,
            w.name AS worker_name
          FROM stock_movements sm
          LEFT JOIN stock_items si ON si.id = sm.item_id
          LEFT JOIN staff s        ON s.id  = sm.created_by
          LEFT JOIN workers w      ON w.id  = sm.worker_id
          WHERE sm.salon_id = ${user.salon_id} AND sm.item_id = ${itemId}
            AND (${branchId}::uuid IS NULL OR sm.branch_id = ${branchId}::uuid)
          ORDER BY sm.created_at DESC LIMIT ${limit}`
      : await sql`
          SELECT sm.*,
            json_build_object('name', si.name, 'unit', si.unit) AS item,
            json_build_object('name', s.name)                   AS staff,
            w.name AS worker_name
          FROM stock_movements sm
          LEFT JOIN stock_items si ON si.id = sm.item_id
          LEFT JOIN staff s        ON s.id  = sm.created_by
          LEFT JOIN workers w      ON w.id  = sm.worker_id
          WHERE sm.salon_id = ${user.salon_id}
            AND (${branchId}::uuid IS NULL OR sm.branch_id = ${branchId}::uuid)
          ORDER BY sm.created_at DESC LIMIT ${limit}`;

    let enriched: any[] = data as any[];
    const branchIds = [...new Set(enriched.map(m => m.branch_id).filter(Boolean))] as string[];
    if (branchIds.length > 0) {
      const brRows = await sql`SELECT id, name FROM branches WHERE id = ANY(${branchIds})`;
      const brMap: Record<string, string> = Object.fromEntries((brRows as any[]).map(b => [b.id, b.name]));
      enriched = enriched.map(m => ({ ...m, branch_name: m.branch_id ? (brMap[m.branch_id] ?? null) : null }));
    }

    return NextResponse.json(enriched);
  } catch (err) {
    console.error('GET /api/inventory/movements error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { item_id, qty_change, reason, notes, worker_id } = await request.json();
    if (!item_id)                    return NextResponse.json({ error: 'item_id is required' }, { status: 400 });
    if (!qty_change || qty_change === 0) return NextResponse.json({ error: 'qty_change must be non-zero' }, { status: 400 });

    const branchId = user.branch_id;

    const [item] = await sql`
      SELECT current_qty, branch_id FROM stock_items
      WHERE id = ${item_id} AND salon_id = ${user.salon_id}
        AND (${branchId}::uuid IS NULL OR branch_id = ${branchId}::uuid)`;

    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const newQty = Number(item.current_qty) + Number(qty_change);
    if (newQty < 0) return NextResponse.json({ error: 'Quantity cannot go below zero' }, { status: 400 });

    await sql`UPDATE stock_items SET current_qty = ${newQty}, updated_at = NOW() WHERE id = ${item_id}`;

    const [movement] = await sql`
      INSERT INTO stock_movements
        (salon_id, branch_id, item_id, qty_change, qty_after, reason, notes, created_by, worker_id)
      VALUES
        (${user.salon_id}, ${item.branch_id}, ${item_id}, ${Number(qty_change)}, ${newQty},
         ${reason || 'adjustment'}, ${notes?.trim() || null}, ${user.id}, ${worker_id || null})
      RETURNING *`;

    const [withJoins] = await sql`
      SELECT sm.*,
        json_build_object('name', si.name, 'unit', si.unit) AS item,
        json_build_object('name', s.name)                   AS staff,
        w.name AS worker_name
      FROM stock_movements sm
      LEFT JOIN stock_items si ON si.id = sm.item_id
      LEFT JOIN staff s        ON s.id  = sm.created_by
      LEFT JOIN workers w      ON w.id  = sm.worker_id
      WHERE sm.id = ${movement.id}`;

    return NextResponse.json({ movement: withJoins, new_qty: newQty }, { status: 201 });
  } catch (err) {
    console.error('POST /api/inventory/movements error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
