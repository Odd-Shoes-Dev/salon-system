import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { checkAccountBalance } from '@/lib/accounts';

type Params = { params: Promise<{ id: string }> };

// POST /api/accounts/transactions/[id]/reverse
// Corrects a wrong transfer by posting a new correcting entry pair instead
// of editing the original — the mistake and the fix both stay in the
// ledger. `id` may be either leg (the 'out' or 'in' side) of the transfer.
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;

    const [leg] = await sql`
      SELECT * FROM account_transactions
      WHERE id = ${id} AND salon_id = ${user.salon_id} AND reference_type = 'transfer'`;
    if (!leg) return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
    if (leg.reversed_at) return NextResponse.json({ error: 'This transfer has already been reversed' }, { status: 400 });
    if (!leg.reference_id) return NextResponse.json({ error: 'Could not find the paired transfer leg' }, { status: 400 });

    const [pairedLeg] = await sql`
      SELECT * FROM account_transactions
      WHERE id = ${leg.reference_id} AND salon_id = ${user.salon_id} AND reference_type = 'transfer'`;
    if (!pairedLeg) return NextResponse.json({ error: 'Could not find the paired transfer leg' }, { status: 400 });
    if (pairedLeg.reversed_at) return NextResponse.json({ error: 'This transfer has already been reversed' }, { status: 400 });

    const outLeg = leg.direction === 'out' ? leg : pairedLeg;
    const inLeg  = leg.direction === 'out' ? pairedLeg : leg;

    const amount = Number(outLeg.amount);

    // Reversing pulls the money back out of the account that received it —
    // confirm it's still there to take back.
    const balanceCheck = await checkAccountBalance(inLeg.account_id, user.salon_id, amount);
    if (!balanceCheck.ok) return NextResponse.json({ error: balanceCheck.error }, { status: balanceCheck.status });

    const today = new Date().toISOString().split('T')[0];
    const desc = `Reversal: ${outLeg.description || 'Transfer'}`;

    // New correcting pair: money flows back the opposite way.
    const [reversalOut] = await sql`
      INSERT INTO account_transactions (salon_id, account_id, amount, direction, description, reference_type, recorded_by, transaction_date)
      VALUES (${user.salon_id}, ${inLeg.account_id}, ${amount}, 'out', ${desc}, 'transfer_reversal', ${user.id}, ${today})
      RETURNING *`;

    const [reversalIn] = await sql`
      INSERT INTO account_transactions (salon_id, account_id, amount, direction, description, reference_type, recorded_by, transaction_date, reference_id)
      VALUES (${user.salon_id}, ${outLeg.account_id}, ${amount}, 'in', ${desc}, 'transfer_reversal', ${user.id}, ${today}, ${reversalOut.id})
      RETURNING *`;

    await sql`UPDATE account_transactions SET reference_id = ${reversalIn.id} WHERE id = ${reversalOut.id}`;

    // Mark the original pair as reversed so it can't be reversed again.
    await sql`UPDATE account_transactions SET reversed_at = NOW() WHERE id IN (${outLeg.id}, ${inLeg.id})`;

    return NextResponse.json({ success: true, reversalOut, reversalIn }, { status: 201 });
  } catch (error) {
    console.error('Transfer reversal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
