import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // All active accounts for this salon
    const accounts = await sql`
      SELECT id, name, type, is_system
      FROM accounts
      WHERE salon_id = ${user.salon_id} AND is_active = true
      ORDER BY is_system DESC, name ASC`;

    // Daily summary queries (run regardless of accounts)
    const [revRow] = await sql`
      SELECT COALESCE(SUM(amount), 0) AS revenue
      FROM account_transactions
      WHERE salon_id = ${user.salon_id}
        AND transaction_date = ${date}
        AND reference_type = 'visit'
        AND direction = 'in'`;

    const [expRow] = await sql`
      SELECT COALESCE(SUM(amount), 0) AS expenses
      FROM expenses
      WHERE salon_id = ${user.salon_id}
        AND expense_date = ${date}
        AND deleted_at IS NULL`;

    const [purRow] = await sql`
      SELECT COALESCE(SUM(total_cost), 0) AS purchases
      FROM purchases
      WHERE salon_id = ${user.salon_id}
        AND purchase_date = ${date}`;

    const revenue   = Number((revRow as any)?.revenue)   || 0;
    const expenses  = Number((expRow as any)?.expenses)  || 0;
    const purchases = Number((purRow as any)?.purchases) || 0;
    const daily_summary = { revenue, expenses, purchases, daily_net: revenue - expenses };

    if ((accounts as any[]).length === 0) {
      return NextResponse.json({
        date,
        accounts: [],
        transactions: [],
        totals: { opening_balance: 0, money_in: 0, money_out: 0, closing_balance: 0 },
        daily_summary,
      });
    }

    const accountIds = (accounts as any[]).map((a: any) => a.id);

    // Opening balance (all transactions before date) + day in/out, per account
    const aggregates = await sql`
      SELECT
        account_id,
        SUM(CASE WHEN transaction_date < ${date}
              THEN (CASE WHEN direction = 'in' THEN amount ELSE -amount END)
              ELSE 0 END)                                                          AS opening_balance,
        SUM(CASE WHEN transaction_date = ${date} AND direction = 'in'  THEN amount ELSE 0 END) AS money_in,
        SUM(CASE WHEN transaction_date = ${date} AND direction = 'out' THEN amount ELSE 0 END) AS money_out
      FROM account_transactions
      WHERE salon_id = ${user.salon_id}
        AND account_id = ANY(${accountIds})
        AND transaction_date <= ${date}
      GROUP BY account_id`;

    const aggMap: Record<string, any> = {};
    for (const row of aggregates as any[]) aggMap[row.account_id] = row;

    const accountRows = (accounts as any[]).map((acct: any) => {
      const agg = aggMap[acct.id] || {};
      const opening  = Number(agg.opening_balance) || 0;
      const moneyIn  = Number(agg.money_in)        || 0;
      const moneyOut = Number(agg.money_out)        || 0;
      return {
        id:              acct.id,
        name:            acct.name,
        type:            acct.type,
        is_system:       acct.is_system,
        opening_balance: opening,
        money_in:        moneyIn,
        money_out:       moneyOut,
        closing_balance: opening + moneyIn - moneyOut,
      };
    });

    // Individual transactions for the selected day
    const transactions = await sql`
      SELECT
        at.id,
        at.account_id,
        a.name            AS account_name,
        at.amount,
        at.direction,
        at.description,
        at.reference_type,
        at.reference_id,
        at.transaction_date,
        s.name            AS recorded_by_name
      FROM account_transactions at
      JOIN accounts a ON a.id = at.account_id
      LEFT JOIN staff s ON s.id = at.recorded_by
      WHERE at.salon_id = ${user.salon_id}
        AND at.transaction_date = ${date}
      ORDER BY at.created_at ASC`;

    const totals = accountRows.reduce(
      (acc, a) => ({
        opening_balance: acc.opening_balance + a.opening_balance,
        money_in:        acc.money_in        + a.money_in,
        money_out:       acc.money_out       + a.money_out,
        closing_balance: acc.closing_balance + a.closing_balance,
      }),
      { opening_balance: 0, money_in: 0, money_out: 0, closing_balance: 0 },
    );

    return NextResponse.json({ date, accounts: accountRows, transactions, totals, daily_summary });
  } catch (err) {
    console.error('GET /api/reports/daybook error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
