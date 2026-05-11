import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const groupId  = searchParams.get('group_id');
    const lowStock = searchParams.get('low_stock') === 'true';

    const items = groupId
      ? await sql`
          SELECT si.*, json_build_object('id', sg.id, 'name', sg.name, 'color', sg.color) AS group
          FROM stock_items si LEFT JOIN stock_groups sg ON sg.id = si.group_id
          WHERE si.salon_id = ${user.salon_id} AND si.is_active = true AND si.deleted_at IS NULL AND si.group_id = ${groupId}
          ORDER BY si.name`
      : await sql`
          SELECT si.*, json_build_object('id', sg.id, 'name', sg.name, 'color', sg.color) AS group
          FROM stock_items si LEFT JOIN stock_groups sg ON sg.id = si.group_id
          WHERE si.salon_id = ${user.salon_id} AND si.is_active = true AND si.deleted_at IS NULL
          ORDER BY si.name`;

    const filtered = lowStock ? items.filter((i: any) => Number(i.current_qty) <= Number(i.reorder_level)) : items;
    const totalValue    = items.reduce((s: number, i: any) => s + Number(i.current_qty) * Number(i.cost_per_unit), 0);
    const lowStockCount = items.filter((i: any) => Number(i.current_qty) <= Number(i.reorder_level) && Number(i.reorder_level) > 0).length;

    return NextResponse.json({ items: filtered, summary: { totalValue, lowStockCount, totalItems: items.length } });
  } catch (err) {
    console.error('GET /api/inventory/items error:', err);
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

    const { name, description, unit, group_id, current_qty, reorder_level, cost_per_unit, supplier } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    try {
      const [data] = await sql`
        INSERT INTO stock_items (salon_id, group_id, name, description, unit, current_qty, reorder_level, cost_per_unit, supplier)
        VALUES (${user.salon_id}, ${group_id || null}, ${name.trim()}, ${description?.trim() || null}, ${unit || 'pcs'}, ${Number(current_qty) || 0}, ${Number(reorder_level) || 0}, ${Number(cost_per_unit) || 0}, ${supplier?.trim() || null})
        RETURNING *`;

      if (Number(current_qty) > 0) {
        await sql`
          INSERT INTO stock_movements (salon_id, item_id, qty_change, qty_after, reason, notes, created_by)
          VALUES (${user.salon_id}, ${data.id}, ${Number(current_qty)}, ${Number(current_qty)}, 'purchase', 'Opening stock', ${user.id})`;
      }

      // Return with group joined
      const [withGroup] = await sql`
        SELECT si.*, json_build_object('id', sg.id, 'name', sg.name, 'color', sg.color) AS group
        FROM stock_items si LEFT JOIN stock_groups sg ON sg.id = si.group_id WHERE si.id = ${data.id}`;
      return NextResponse.json(withGroup, { status: 201 });
    } catch (err: any) {
      if (err.code === '23505') return NextResponse.json({ error: 'An item with this name already exists' }, { status: 409 });
      throw err;
    }
  } catch (err) {
    console.error('POST /api/inventory/items error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
