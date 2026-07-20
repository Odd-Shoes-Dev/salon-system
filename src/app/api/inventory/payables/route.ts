import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const status = new URL(req.url).searchParams.get('status') || 'outstanding';

    const items = status === 'all'
      ? await sql`
          SELECT sp.*, sup.name AS supplier_name, e.name AS equipment_name
          FROM supplier_payables sp
          LEFT JOIN suppliers sup ON sup.id = sp.supplier_id
          LEFT JOIN equipment  e  ON e.id   = sp.equipment_id
          WHERE sp.salon_id = ${user.salon_id}
          ORDER BY sp.created_at DESC`
      : status === 'partial'
      ? await sql`
          SELECT sp.*, sup.name AS supplier_name, e.name AS equipment_name
          FROM supplier_payables sp
          LEFT JOIN suppliers sup ON sup.id = sp.supplier_id
          LEFT JOIN equipment  e  ON e.id   = sp.equipment_id
          WHERE sp.salon_id = ${user.salon_id} AND sp.status IN ('outstanding', 'partial')
          ORDER BY sp.due_date ASC NULLS LAST, sp.created_at DESC`
      : await sql`
          SELECT sp.*, sup.name AS supplier_name, e.name AS equipment_name
          FROM supplier_payables sp
          LEFT JOIN suppliers sup ON sup.id = sp.supplier_id
          LEFT JOIN equipment  e  ON e.id   = sp.equipment_id
          WHERE sp.salon_id = ${user.salon_id} AND sp.status = ${status}
          ORDER BY sp.due_date ASC NULLS LAST, sp.created_at DESC`;

    const [{ total_outstanding }] = await sql`
      SELECT COALESCE(SUM(amount - amount_paid), 0) AS total_outstanding
      FROM supplier_payables
      WHERE salon_id = ${user.salon_id} AND status IN ('outstanding', 'partial')`;

    const today = new Date().toISOString().slice(0, 10);
    const overdueCount = (items as any[]).filter(
      p => ['outstanding', 'partial'].includes(p.status) && p.due_date && String(p.due_date).slice(0, 10) < today
    ).length;

    return NextResponse.json({ items, summary: { totalOutstanding: Number(total_outstanding), overdueCount } });
  } catch (err) {
    console.error('GET /api/inventory/payables error:', err);
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

    const { supplier_id, equipment_id, description, amount, due_date, notes } = await req.json();
    if (!description?.trim()) return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    if (!amount || Number(amount) <= 0) return NextResponse.json({ error: 'Amount is required' }, { status: 400 });

    const [item] = await sql`
      INSERT INTO supplier_payables (salon_id, branch_id, supplier_id, equipment_id, description, amount, due_date, notes)
      VALUES (
        ${user.salon_id}, ${user.branch_id ?? null},
        ${supplier_id || null},
        ${equipment_id || null},
        ${description.trim()},
        ${Number(amount)},
        ${due_date || null},
        ${notes?.trim() || null}
      )
      RETURNING *`;

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error('POST /api/inventory/payables error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
