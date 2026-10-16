import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// POST /api/balance-sheet/liabilities/[id]/repay
// Body: { amount, account_id, notes? }
// Always a real cash movement — unlike staff advances, a loan repayment has
// no "contra" equivalent here. Dr the liability, Cr the account.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const { amount, account_id, notes } = await req.json();

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }
    if (!account_id) {
      return NextResponse.json({ error: 'Account is required' }, { status: 400 });
    }

    const [liability] = await sql`
      SELECT * FROM other_liabilities
      WHERE id = ${id} AND salon_id = ${user.salon_id} AND deleted_at IS NULL`;
    if (!liability) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const remaining = Number(liability.total_amount) - Number(liability.amount_repaid);
    const repayAmount = Math.round(Number(amount));
    if (repayAmount > remaining) {
      return NextResponse.json({ error: `Amount exceeds the remaining balance of ${remaining}` }, { status: 400 });
    }

    const [account] = await sql`SELECT id FROM accounts WHERE id = ${account_id} AND salon_id = ${user.salon_id} AND is_active = true`;
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const [repayment] = await sql`
      INSERT INTO other_liability_repayments (salon_id, liability_id, amount, account_id, notes, recorded_by)
      VALUES (${user.salon_id}, ${id}, ${repayAmount}, ${account.id}, ${notes?.trim() || null}, ${user.id})
      RETURNING *`;

    const [updated] = await sql`
      UPDATE other_liabilities
      SET amount_repaid = amount_repaid + ${repayAmount}, updated_at = NOW()
      WHERE id = ${id} AND salon_id = ${user.salon_id}
      RETURNING *`;

    try {
      await sql`
        INSERT INTO account_transactions (salon_id, account_id, amount, direction, description, reference_type, reference_id, recorded_by, transaction_date)
        VALUES (${user.salon_id}, ${account.id}, ${repayAmount}, 'out', ${`Loan repayment: ${liability.description}`}, 'loan_repayment', ${repayment.id}, ${user.id}, ${new Date().toISOString().split('T')[0]})`;
    } catch (txErr) {
      console.warn('Failed to record loan repayment transaction:', txErr);
    }

    return NextResponse.json({ liability: updated, repayment });
  } catch (err) {
    console.error('POST /api/balance-sheet/liabilities/[id]/repay error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
