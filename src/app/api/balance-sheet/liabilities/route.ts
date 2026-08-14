import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rows = await sql`
      SELECT id, description, category, total_amount, amount_repaid, due_date, notes, created_at
      FROM other_liabilities
      WHERE salon_id = ${user.salon_id} AND deleted_at IS NULL
      ORDER BY created_at ASC`;

    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/balance-sheet/liabilities error:', err);
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

    const body = await req.json();
    const { description, category, total_amount, amount_repaid, due_date, notes } = body;

    if (!description?.trim()) return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    if (!total_amount || Number(total_amount) <= 0) return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });

    const [row] = await sql`
      INSERT INTO other_liabilities
        (salon_id, description, category, total_amount, amount_repaid, due_date, notes, created_by)
      VALUES (
        ${user.salon_id},
        ${description.trim()},
        ${category || 'other'},
        ${Number(total_amount)},
        ${Number(amount_repaid) || 0},
        ${due_date || null},
        ${notes?.trim() || null},
        ${user.id}
      )
      RETURNING *`;

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error('POST /api/balance-sheet/liabilities error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
