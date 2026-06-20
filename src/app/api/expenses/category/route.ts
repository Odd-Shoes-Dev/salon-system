import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/expenses/category?name=<category>&from_date=&to_date=
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const name     = searchParams.get('name');
    const fromDate = searchParams.get('from_date');
    const toDate   = searchParams.get('to_date');

    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    const branchId = user.branch_id;

    // All-time aggregates for this category
    const [allTime] = await sql`
      SELECT
        COALESCE(SUM(amount), 0)::numeric AS total,
        COUNT(*)::int                      AS count,
        MAX(expense_date)                  AS last_date,
        MAX(amount)::numeric               AS largest
      FROM expenses
      WHERE salon_id = ${user.salon_id}
        AND deleted_at IS NULL
        AND category = ${name}
        AND (${branchId}::uuid IS NULL OR branch_id = ${branchId}::uuid)
    `;

    // Monthly trend — last 12 months
    const monthly = await sql`
      SELECT
        TO_CHAR(expense_date, 'YYYY-MM') AS month,
        COALESCE(SUM(amount), 0)::numeric AS total,
        COUNT(*)::int                     AS count
      FROM expenses
      WHERE salon_id = ${user.salon_id}
        AND deleted_at IS NULL
        AND category = ${name}
        AND expense_date >= (CURRENT_DATE - INTERVAL '12 months')::date
        AND (${branchId}::uuid IS NULL OR branch_id = ${branchId}::uuid)
      GROUP BY month
      ORDER BY month ASC
    `;

    // Period expenses (or all if no dates given)
    const fromISO = fromDate ?? '2000-01-01';
    const toISO   = toDate   ?? new Date().toISOString().split('T')[0];

    const rows = await sql`
      SELECT id, amount, description, expense_date, payment_method, created_at
      FROM expenses
      WHERE salon_id = ${user.salon_id}
        AND deleted_at IS NULL
        AND category = ${name}
        AND expense_date >= ${fromISO}
        AND expense_date <= ${toISO}
        AND (${branchId}::uuid IS NULL OR branch_id = ${branchId}::uuid)
      ORDER BY expense_date DESC
    `;

    const periodRows = rows as any[];
    const periodTotal   = periodRows.reduce((s, r) => s + Number(r.amount), 0);
    const periodCount   = periodRows.length;
    const periodAvg     = periodCount > 0 ? periodTotal / periodCount : 0;
    const periodLargest = periodRows.reduce((m, r) => Math.max(m, Number(r.amount)), 0);

    const lastDate    = allTime.last_date ? new Date(allTime.last_date) : null;
    const daysSinceLast = lastDate
      ? Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return NextResponse.json({
      category: name,
      allTime: {
        total:       Number(allTime.total),
        count:       Number(allTime.count),
        largest:     Number(allTime.largest),
        lastDate:    allTime.last_date ?? null,
        daysSinceLast,
      },
      monthlyTrend: (monthly as any[]).map(r => ({
        month: r.month,
        total: Number(r.total),
        count: Number(r.count),
      })),
      period: {
        total:   periodTotal,
        count:   periodCount,
        avg:     periodAvg,
        largest: periodLargest,
      },
      expenses: periodRows.map(r => ({
        id:             r.id,
        amount:         Number(r.amount),
        description:    r.description || null,
        expense_date:   r.expense_date,
        payment_method: r.payment_method,
      })),
    });
  } catch (error) {
    console.error('Expense category error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
