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
    const { description, category, total_amount, due_date, notes, account_id } = body;

    if (!description?.trim()) return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    if (!total_amount || Number(total_amount) <= 0) return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });

    const [existing] = await sql`
      SELECT amount_repaid, created_at FROM other_liabilities
      WHERE id = ${id} AND salon_id = ${user.salon_id} AND deleted_at IS NULL`;
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (Number(total_amount) < Number(existing.amount_repaid)) {
      return NextResponse.json({ error: 'Total amount cannot be less than the amount already repaid' }, { status: 400 });
    }

    let account: { id: string } | null = null;
    if (account_id) {
      const rows = await sql`SELECT id FROM accounts WHERE id = ${account_id} AND salon_id = ${user.salon_id} AND is_active = true`;
      account = (rows[0] as { id: string } | undefined) ?? null;
      if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // amount_repaid is intentionally not editable here — it bypassed the
    // ledger entirely. Use POST .../repay to record an actual repayment.
    const [row] = await sql`
      UPDATE other_liabilities SET
        description   = ${description.trim()},
        category      = ${category || 'other'},
        total_amount  = ${Number(total_amount)},
        due_date      = ${due_date || null},
        notes         = ${notes?.trim() || null},
        account_id    = ${account?.id ?? null},
        updated_at    = NOW()
      WHERE id = ${id} AND salon_id = ${user.salon_id} AND deleted_at IS NULL
      RETURNING *`;

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Which account "received" this loan (and for how much) is tracked as a
    // ledger entry, not just a column on this row — so changing either here
    // means replacing that entry, the same way editing an expense's account
    // rewrites its linked transaction. Deleting and reinserting (rather than
    // mutating in place) keeps this consistent with how that pattern is done
    // elsewhere in the app. The original transaction_date is preserved (not
    // reset to today) so correcting the account doesn't move the loan to a
    // different day in the day book.
    try {
      const [oldTxn] = await sql`
        SELECT transaction_date FROM account_transactions
        WHERE reference_type = 'loan' AND reference_id = ${id} AND salon_id = ${user.salon_id}`;
      const txnDate = oldTxn?.transaction_date ?? existing.created_at;
      await sql`DELETE FROM account_transactions WHERE reference_type = 'loan' AND reference_id = ${id} AND salon_id = ${user.salon_id}`;
      if (account) {
        await sql`
          INSERT INTO account_transactions (salon_id, account_id, amount, direction, description, reference_type, reference_id, recorded_by, transaction_date)
          VALUES (${user.salon_id}, ${account.id}, ${Number(total_amount)}, 'in', ${`Loan received: ${description.trim()}`}, 'loan', ${id}, ${user.id}, ${txnDate})`;
      }
    } catch (txErr) {
      console.warn('Failed to update loan transaction:', txErr);
    }

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
