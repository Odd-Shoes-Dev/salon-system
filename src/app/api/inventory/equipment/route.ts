import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const items = await sql`
      SELECT e.*, sup.name AS supplier_name
      FROM equipment e
      LEFT JOIN suppliers sup ON sup.id = e.supplier_id
      WHERE e.salon_id = ${user.salon_id} AND e.deleted_at IS NULL
      ORDER BY e.name ASC`;

    const all = items as any[];
    const totalValue     = all.reduce((s, e) => s + Number(e.purchase_cost || 0), 0);
    const needsAttention = all.filter(e => ['poor', 'needs_repair'].includes(e.condition)).length;

    return NextResponse.json({ items: all, summary: { total: all.length, totalValue, needsAttention } });
  } catch (err) {
    console.error('GET /api/inventory/equipment error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { name, category, serial_number, purchase_date, purchase_cost, condition, notes, supplier_id } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const [item] = await sql`
      INSERT INTO equipment (salon_id, branch_id, name, category, serial_number, purchase_date, purchase_cost, condition, notes, supplier_id)
      VALUES (
        ${user.salon_id}, ${user.branch_id ?? null},
        ${name.trim()},
        ${category?.trim() || null},
        ${serial_number?.trim() || null},
        ${purchase_date || null},
        ${purchase_cost ? Number(purchase_cost) : null},
        ${condition || 'good'},
        ${notes?.trim() || null},
        ${supplier_id || null}
      )
      RETURNING *`;

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error('POST /api/inventory/equipment error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
