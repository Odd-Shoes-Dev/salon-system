import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Account balances as of the given date
    const accounts = await sql`
      SELECT
        a.id, a.name, a.type,
        COALESCE(SUM(
          CASE WHEN at.direction = 'in'  THEN at.amount
               WHEN at.direction = 'out' THEN -at.amount
               ELSE 0 END
        ), 0) AS balance
      FROM accounts a
      LEFT JOIN account_transactions at
        ON at.account_id = a.id
       AND at.transaction_date <= ${date}
       AND at.salon_id = ${user.salon_id}
      WHERE a.salon_id = ${user.salon_id} AND a.is_active = true
      GROUP BY a.id, a.name, a.type
      ORDER BY a.is_system DESC, a.name ASC`;

    // Inventory value (current stock × cost)
    const [invRow] = await sql`
      SELECT COALESCE(SUM(current_qty * cost_per_unit), 0) AS inventory_value
      FROM stock_items
      WHERE salon_id = ${user.salon_id} AND deleted_at IS NULL AND current_qty > 0`;

    // Equipment with depreciation fields
    const equipment = await sql`
      SELECT id, name, category, purchase_date, purchase_cost,
             COALESCE(useful_life, 5)   AS useful_life,
             COALESCE(salvage_value, 0) AS salvage_value,
             condition
      FROM equipment
      WHERE salon_id = ${user.salon_id}
        AND deleted_at IS NULL
        AND is_active = true
      ORDER BY name ASC`;

    // Outstanding supplier payables
    const [payRow] = await sql`
      SELECT COALESCE(SUM(amount - amount_paid), 0) AS outstanding
      FROM supplier_payables
      WHERE salon_id = ${user.salon_id} AND status != 'paid'`;

    // Manually entered other liabilities
    const otherLiabilities = await sql`
      SELECT id, description, category, total_amount, amount_repaid, due_date, notes
      FROM other_liabilities
      WHERE salon_id = ${user.salon_id} AND deleted_at IS NULL
      ORDER BY created_at ASC`;

    // Straight-line depreciation per equipment item
    const asOfMs = new Date(date + 'T12:00:00').getTime();
    const equipmentRows = (equipment as any[]).map(eq => {
      const cost    = Number(eq.purchase_cost) || 0;
      const salvage = Number(eq.salvage_value) || 0;
      const life    = Number(eq.useful_life)   || 5;

      if (!cost || !eq.purchase_date) {
        return { ...eq, cost, accumulated_depreciation: 0, net_book_value: cost };
      }

      const purchaseMs   = new Date(eq.purchase_date + 'T12:00:00').getTime();
      const yearsElapsed = Math.max(0, (asOfMs - purchaseMs) / (365.25 * 24 * 3600 * 1000));
      const annualDep    = life > 0 ? (cost - salvage) / life : 0;
      const accumulated  = Math.min(annualDep * yearsElapsed, cost - salvage);
      const netBookValue = Math.max(cost - accumulated, salvage);

      return {
        ...eq,
        cost,
        accumulated_depreciation: Math.round(accumulated),
        net_book_value: Math.round(netBookValue),
      };
    });

    return NextResponse.json({
      as_of: date,
      assets: {
        accounts: (accounts as any[]).map(a => ({ ...a, balance: Number(a.balance) })),
        inventory_value: Number((invRow as any)?.inventory_value) || 0,
        equipment: equipmentRows,
      },
      liabilities: {
        supplier_payables: Number((payRow as any)?.outstanding) || 0,
        other: (otherLiabilities as any[]).map(l => ({
          ...l,
          total_amount:  Number(l.total_amount),
          amount_repaid: Number(l.amount_repaid),
          outstanding:   Number(l.total_amount) - Number(l.amount_repaid),
        })),
      },
    });
  } catch (err) {
    console.error('GET /api/balance-sheet error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
