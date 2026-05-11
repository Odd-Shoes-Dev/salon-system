import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('item_id');
    const limit  = Number(searchParams.get('limit') || 50);

    const data = itemId
      ? await sql`
          SELECT sm.*, json_build_object('name', si.name, 'unit', si.unit) AS item, json_build_object('name', s.name) AS staff
          FROM stock_movements sm
          LEFT JOIN stock_items si ON si.id = sm.item_id
          LEFT JOIN staff s ON s.id = sm.created_by
          WHERE sm.salon_id = ${user.salon_id} AND sm.item_id = ${itemId}
          ORDER BY sm.created_at DESC LIMIT ${limit}`
      : await sql`
          SELECT sm.*, json_build_object('name', si.name, 'unit', si.unit) AS item, json_build_object('name', s.name) AS staff
          FROM stock_movements sm
          LEFT JOIN stock_items si ON si.id = sm.item_id
          LEFT JOIN staff s ON s.id = sm.created_by
          WHERE sm.salon_id = ${user.salon_id}
          ORDER BY sm.created_at DESC LIMIT ${limit}`;

    return NextResponse.json(data);
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

    const { item_id, qty_change, reason, notes } = await request.json();
    if (!item_id) return NextResponse.json({ error: 'item_id is required' }, { status: 400 });
    if (!qty_change || qty_change === 0) return NextResponse.json({ error: 'qty_change must be non-zero' }, { status: 400 });

    const [item] = await sql`SELECT current_qty FROM stock_items WHERE id = ${item_id} AND salon_id = ${user.salon_id}`;
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const newQty = Number(item.current_qty) + Number(qty_change);
    if (newQty < 0) return NextResponse.json({ error: 'Quantity cannot go below zero' }, { status: 400 });

    await sql`UPDATE stock_items SET current_qty = ${newQty}, updated_at = NOW() WHERE id = ${item_id}`;

    const [movement] = await sql`
      INSERT INTO stock_movements (salon_id, item_id, qty_change, qty_after, reason, notes, created_by)
      VALUES (${user.salon_id}, ${item_id}, ${Number(qty_change)}, ${newQty}, ${reason || 'adjustment'}, ${notes?.trim() || null}, ${user.id})
      RETURNING *`;

    const [withJoins] = await sql`
      SELECT sm.*, json_build_object('name', si.name, 'unit', si.unit) AS item, json_build_object('name', s.name) AS staff
      FROM stock_movements sm
      LEFT JOIN stock_items si ON si.id = sm.item_id
      LEFT JOIN staff s ON s.id = sm.created_by
      WHERE sm.id = ${movement.id}`;

    return NextResponse.json({ movement: withJoins, new_qty: newQty }, { status: 201 });
  } catch (err) {
    console.error('POST /api/inventory/movements error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
