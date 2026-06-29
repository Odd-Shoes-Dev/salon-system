import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// POST /api/accounts/transfer — move money between accounts
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { from_account_id, to_account_id, amount, description, transaction_date } = await request.json();

    if (!from_account_id || !to_account_id) {
      return NextResponse.json({ error: 'Source and destination accounts are required' }, { status: 400 });
    }
    if (from_account_id === to_account_id) {
      return NextResponse.json({ error: 'Cannot transfer to the same account' }, { status: 400 });
    }

    const transferAmount = Math.round(Number(amount));
    if (!transferAmount || transferAmount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    // Verify both accounts belong to this salon, are active, and have sufficient balance
    const [fromAccount] = await sql`SELECT * FROM account_balances WHERE id = ${from_account_id} AND salon_id = ${user.salon_id}`;
    const [toAccount] = await sql`SELECT id, name, is_active FROM accounts WHERE id = ${to_account_id} AND salon_id = ${user.salon_id}`;

    if (!fromAccount) return NextResponse.json({ error: 'Source account not found' }, { status: 404 });
    if (!toAccount) return NextResponse.json({ error: 'Destination account not found' }, { status: 404 });
    if (!fromAccount.is_active) return NextResponse.json({ error: 'Source account is inactive' }, { status: 400 });
    if (!toAccount.is_active) return NextResponse.json({ error: 'Destination account is inactive' }, { status: 400 });

    const sourceBalance = Number(fromAccount.balance || 0);
    if (transferAmount > sourceBalance) {
      return NextResponse.json({
        error: `Insufficient balance. ${fromAccount.name} has ${sourceBalance.toLocaleString('en-UG')} UGX available.`,
      }, { status: 400 });
    }

    const txDate = transaction_date || new Date().toISOString().split('T')[0];
    const desc = description?.trim() || `Transfer: ${fromAccount.name} → ${toAccount.name}`;

    // Create paired transactions
    const [outTxn] = await sql`
      INSERT INTO account_transactions (salon_id, account_id, amount, direction, description, reference_type, recorded_by, transaction_date)
      VALUES (${user.salon_id}, ${from_account_id}, ${transferAmount}, 'out', ${desc}, 'transfer', ${user.id}, ${txDate})
      RETURNING *`;

    const [inTxn] = await sql`
      INSERT INTO account_transactions (salon_id, account_id, amount, direction, description, reference_type, recorded_by, transaction_date, reference_id)
      VALUES (${user.salon_id}, ${to_account_id}, ${transferAmount}, 'in', ${desc}, 'transfer', ${user.id}, ${txDate}, ${outTxn.id})
      RETURNING *`;

    // Link the out transaction to the in transaction
    await sql`UPDATE account_transactions SET reference_id = ${inTxn.id} WHERE id = ${outTxn.id}`;

    return NextResponse.json({
      success: true,
      from: { account: fromAccount.name, amount: transferAmount, direction: 'out' },
      to: { account: toAccount.name, amount: transferAmount, direction: 'in' },
    }, { status: 201 });
  } catch (error) {
    console.error('Transfer error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
