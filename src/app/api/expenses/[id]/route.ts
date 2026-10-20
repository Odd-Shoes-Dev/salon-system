import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { checkAccountBalance } from '@/lib/accounts';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Only managers and above can edit expenses' }, { status: 403 });
    }

    const { id } = await params;
    const { category, amount, description, expense_date, account_id } = await request.json();

    if (!category?.trim()) return NextResponse.json({ error: 'Category is required' }, { status: 400 });
    if (!amount || Number(amount) <= 0) return NextResponse.json({ error: 'Amount must be > 0' }, { status: 400 });

    const branchId = user.branch_id;

    // Check the paying account can cover the new amount before committing the
    // edit. If this expense already has a transaction on the SAME account,
    // that old amount is being replaced (not added on top), so it's credited
    // back before comparing against the balance. Switching to a different
    // account gets no such credit — the full new amount must fit there.
    const [oldTxn] = await sql`
      SELECT account_id, amount FROM account_transactions
      WHERE reference_type = 'expense' AND reference_id = ${id} AND salon_id = ${user.salon_id}`;

    let acctId: string | null = null;
    let pm = 'other';
    if (account_id) {
      const refund = oldTxn && oldTxn.account_id === account_id ? Number(oldTxn.amount) : 0;
      const balanceCheck = await checkAccountBalance(account_id, user.salon_id, Number(amount) - refund);
      if (!balanceCheck.ok) return NextResponse.json({ error: balanceCheck.error }, { status: balanceCheck.status });
      acctId = balanceCheck.account.id;
      pm = balanceCheck.account.type === 'expense' ? 'bank' : balanceCheck.account.type;
    }

    const [data] = await sql`
      UPDATE expenses SET
        category       = ${category.trim()},
        amount         = ${Number(amount)},
        description    = ${description?.trim() || null},
        expense_date   = ${expense_date},
        payment_method = ${pm},
        account_id     = ${acctId},
        updated_at     = NOW()
      WHERE id = ${id} AND salon_id = ${user.salon_id} AND deleted_at IS NULL
        AND (${branchId}::uuid IS NULL OR branch_id = ${branchId}::uuid)
      RETURNING *`;

    if (!data) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

    // Remove old account transaction and rewrite with updated values (non-fatal)
    try {
      await sql`DELETE FROM account_transactions WHERE reference_type = 'expense' AND reference_id = ${id} AND salon_id = ${user.salon_id}`;
      if (acctId) {
        await sql`INSERT INTO account_transactions (salon_id, account_id, amount, direction, description, reference_type, reference_id, recorded_by, transaction_date)
          VALUES (${user.salon_id}, ${acctId}, ${Number(amount)}, 'out', ${description?.trim() || category.trim()}, 'expense', ${id}, ${user.id}, ${expense_date})`;
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
