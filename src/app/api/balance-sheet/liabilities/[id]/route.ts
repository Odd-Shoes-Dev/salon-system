import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { description, category, total_amount, due_date, notes } = body;

    if (!description?.trim()) return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    if (!total_amount || Number(total_amount) <= 0) return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });

    // amount_repaid is intentionally not editable here anymore — it bypassed
    // the ledger entirely. Use POST .../repay to record an actual repayment.
    const [row] = await sql`
      UPDATE other_liabilities SET
        description   = ${description.trim()},
        category      = ${category || 'other'},
        total_amount  = ${Number(total_amount)},
        due_date      = ${due_date || null},
        notes         = ${notes?.trim() || null},
        updated_at    = NOW()
      WHERE id = ${id} AND salon_id = ${user.salon_id} AND deleted_at IS NULL
      RETURNING *`;

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(row);
  } catch (err) {
    console.error('PUT /api/balance-sheet/liabilities/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    await sql`
      UPDATE other_liabilities SET deleted_at = NOW()
      WHERE id = ${id} AND salon_id = ${user.salon_id}`;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/balance-sheet/liabilities/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
