import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Only managers and above can edit expenses' }, { status: 403 });
    }

    const { id } = await params;
    const { category, amount, description, expense_date, payment_method } = await request.json();

    if (!category?.trim()) return NextResponse.json({ error: 'Category is required' }, { status: 400 });
    if (!amount || Number(amount) <= 0) return NextResponse.json({ error: 'Amount must be > 0' }, { status: 400 });

    const validPM = ['cash', 'mtn_mobile_money', 'airtel_money', 'other'];
    const pm = validPM.includes(payment_method) ? payment_method : 'cash';

    const branchId = user.branch_id;

    const [data] = await sql`
      UPDATE expenses SET
        category       = ${category.trim()},
        amount         = ${Number(amount)},
        description    = ${description?.trim() || null},
        expense_date   = ${expense_date},
        payment_method = ${pm},
        updated_at     = NOW()
      WHERE id = ${id} AND salon_id = ${user.salon_id} AND deleted_at IS NULL
        AND (${branchId}::uuid IS NULL OR branch_id = ${branchId}::uuid)
      RETURNING *`;

    if (!data) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

    // Remove old account transaction and rewrite with updated values (non-fatal)
    try {
      await sql`DELETE FROM account_transactions WHERE reference_type = 'expense' AND reference_id = ${id} AND salon_id = ${user.salon_id}`;
      if (pm !== 'other') {
        const [acct] = await sql`SELECT id FROM accounts WHERE salon_id = ${user.salon_id} AND type = ${pm} AND is_system = true`;
        if (acct) {
          await sql`INSERT INTO account_transactions (salon_id, account_id, amount, direction, description, reference_type, reference_id, recorded_by, transaction_date)
            VALUES (${user.salon_id}, ${acct.id}, ${Number(amount)}, 'out', ${description?.trim() || category.trim()}, 'expense', ${id}, ${user.id}, ${expense_date})`;
        }
      }
    } catch (accErr) {
      console.error('Expense account transaction update error (non-fatal):', accErr);
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('PUT /api/expenses/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Only owners and admins can delete expenses' }, { status: 403 });
    }

    const { id } = await params;
    const branchId = user.branch_id;
    await sql`
      UPDATE expenses SET deleted_at = NOW()
      WHERE id = ${id} AND salon_id = ${user.salon_id}
        AND (${branchId}::uuid IS NULL OR branch_id = ${branchId}::uuid)`;

    // Remove the corresponding account transaction (non-fatal)
    try {
      await sql`DELETE FROM account_transactions WHERE reference_type = 'expense' AND reference_id = ${id} AND salon_id = ${user.salon_id}`;
    } catch (accErr) {
      console.error('Expense account transaction delete error (non-fatal):', accErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/expenses/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
