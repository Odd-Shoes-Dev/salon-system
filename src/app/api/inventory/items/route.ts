import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const ITEM_SELECT = `
  SELECT
    si.*,
    json_build_object('id', sg.id, 'name', sg.name, 'color', sg.color, 'parent_id', sg.parent_id) AS "group",
    json_build_object('id', sup.id, 'name', sup.name)                                              AS supplier
  FROM stock_items si
  LEFT JOIN stock_groups sg  ON sg.id  = si.group_id
  LEFT JOIN suppliers    sup ON sup.id = si.supplier_id
`;

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const groupId    = searchParams.get('group_id');
    const supplierId = searchParams.get('supplier_id');
    const lowStock   = searchParams.get('low_stock') === 'true';
    const branchId   = user.branch_id;

    const items = await sql`
      ${sql.unsafe(ITEM_SELECT)}
      WHERE si.salon_id    = ${user.salon_id}
        AND si.is_active   = true
        AND si.deleted_at  IS NULL
        AND (${branchId}::uuid   IS NULL OR si.branch_id   = ${branchId}::uuid)
        AND (${groupId}::uuid    IS NULL OR si.group_id    = ${groupId}::uuid)
        AND (${supplierId}::uuid IS NULL OR si.supplier_id = ${supplierId}::uuid)
      ORDER BY si.name`;

    const allItems = items as any[];
    const totalValue    = allItems.reduce((s, i) => s + Number(i.current_qty) * Number(i.cost_per_unit), 0);
    const lowStockCount = allItems.filter(i => Number(i.current_qty) <= Number(i.reorder_level) && Number(i.reorder_level) > 0).length;

    let enriched: any[] = lowStock ? allItems.filter(i => Number(i.current_qty) <= Number(i.reorder_level)) : allItems;

    // Attach branch names
    const branchIds = [...new Set(enriched.map(i => i.branch_id).filter(Boolean))] as string[];
    if (branchIds.length > 0) {
      const brRows = await sql`SELECT id, name FROM branches WHERE id = ANY(${branchIds})`;
      const brMap: Record<string, string> = Object.fromEntries((brRows as any[]).map(b => [b.id, b.name]));
      enriched = enriched.map(i => ({ ...i, branch_name: i.branch_id ? (brMap[i.branch_id] ?? null) : null }));
    }

    return NextResponse.json({ items: enriched, summary: { totalValue, lowStockCount, totalItems: allItems.length } });
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

    const { name, description, unit, group_id, supplier_id, sku, current_qty, reorder_level, cost_per_unit } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    let branchId = user.branch_id;
    if (!branchId) {
      const [first] = await sql`SELECT id FROM branches WHERE salon_id = ${user.salon_id} AND deleted_at IS NULL AND is_active = true ORDER BY created_at ASC LIMIT 1`;
      branchId = first?.id ?? null;
    }

    try {
      const [data] = await sql`
        INSERT INTO stock_items
          (salon_id, branch_id, group_id, supplier_id, sku, name, description, unit, current_qty, reorder_level, cost_per_unit)
        VALUES
          (${user.salon_id}, ${branchId}, ${group_id || null}, ${supplier_id || null}, ${sku?.trim() || null},
           ${name.trim()}, ${description?.trim() || null}, ${unit || 'pcs'},
           ${Number(current_qty) || 0}, ${Number(reorder_level) || 0}, ${Number(cost_per_unit) || 0})
        RETURNING *`;

      if (Number(current_qty) > 0) {
        await sql`
          INSERT INTO stock_movements (salon_id, branch_id, item_id, qty_change, qty_after, reason, notes, created_by)
          VALUES (${user.salon_id}, ${branchId}, ${data.id}, ${Number(current_qty)}, ${Number(current_qty)}, 'purchase', 'Opening stock', ${user.id})`;
      }

      const [withJoins] = await sql`${sql.unsafe(ITEM_SELECT)} WHERE si.id = ${data.id}`;
      return NextResponse.json(withJoins, { status: 201 });
    } catch (err: any) {
      if (err.code === '23505') return NextResponse.json({ error: 'An item with this name already exists' }, { status: 409 });
      throw err;
    }
  } catch (err) {
    console.error('POST /api/inventory/items error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
