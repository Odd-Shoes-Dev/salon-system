import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// GET /api/balance-sheet/liabilities/[id]/ledger
// Creditors ledger for one loan: the loan itself (Cr — increases what's
// owed) and every repayment (Dr — decreases it), chronological, with a
// running balance.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const [liability] = await sql`
      SELECT * FROM other_liabilities
      WHERE id = ${id} AND salon_id = ${user.salon_id} AND deleted_at IS NULL`;
    if (!liability) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const repayments = await sql`
      SELECT id, repaid_at::date AS date, amount
      FROM other_liability_repayments
      WHERE liability_id = ${id} AND salon_id = ${user.salon_id}
      ORDER BY repaid_at ASC`;

    type Entry = { date: string; particulars: string; dr: number; cr: number };
    const entries: Entry[] = [
      {
        date: liability.created_at.toISOString().split('T')[0],
        particulars: liability.account_id ? 'Loan received' : 'Opening balance (pre-existing)',
        dr: 0,
        cr: Number(liability.total_amount),
      },
      ...(repayments as any[]).map(r => ({
        date: r.date,
        particulars: 'Repayment',
        dr: Number(r.amount),
        cr: 0,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    let balance = 0;
    const rows = entries.map(e => {
      balance += e.cr - e.dr;
      return { ...e, balance };
    });

    return NextResponse.json({
      description: liability.description,
      entries: rows,
      closing_balance: balance,
    });
  } catch (error) {
    console.error('Liability ledger error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
