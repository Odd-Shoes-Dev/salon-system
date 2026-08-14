import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { localDateStr } from '@/lib/utils';

const VALID_PAYMENT_TYPES = ['cash', 'mtn_mobile_money', 'airtel_money', 'bank', 'credit'];

// GET /api/purchases
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sp       = req.nextUrl.searchParams;
    const from     = sp.get('from') || localDateStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const to       = sp.get('to')   || localDateStr();
    const suppId   = sp.get('supplier_id');
    const status   = sp.get('status'); // 'paid' | 'credit' | null = all

    const rows = await sql`
      SELECT
        p.*,
        sup.name AS supplier_name,
        COUNT(pi.id)::int AS item_count
      FROM purchases p
      LEFT JOIN suppliers    sup ON sup.id = p.supplier_id
      LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
      WHERE p.salon_id = ${user.salon_id}
        AND p.purchase_date >= ${from}
        AND p.purchase_date <= ${to}
        AND (${suppId}::uuid IS NULL OR p.supplier_id = ${suppId}::uuid)
        AND (${status}::text IS NULL OR p.status = ${status}::text)
      GROUP BY p.id, sup.name
      ORDER BY p.purchase_date DESC, p.created_at DESC`;

    const [totals] = await sql`
      SELECT
        COALESCE(SUM(total_cost), 0)                                        AS total_purchases,
        COALESCE(SUM(CASE WHEN status = 'credit' THEN total_cost ELSE 0 END), 0) AS total_on_credit,
        COALESCE(SUM(carriage_inward), 0)                                   AS total_carriage
      FROM purchases
      WHERE salon_id = ${user.salon_id}
        AND purchase_date >= ${from}
        AND purchase_date <= ${to}`;

    return NextResponse.json({ purchases: rows, totals });
  } catch (err) {
    console.error('GET /api/purchases error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/purchases
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await req.json();
    const {
      supplier_id,
      purchase_date,
      payment_type,
      account_id,
      due_date,
      carriage_inward = 0,
      items = [],
      notes,
    } = body;

    if (!purchase_date) return NextResponse.json({ error: 'Purchase date is required' }, { status: 400 });
    if (!VALID_PAYMENT_TYPES.includes(payment_type)) {
      return NextResponse.json({ error: 'Invalid payment type' }, { status: 400 });
    }
    if (payment_type !== 'credit' && !account_id) {
      return NextResponse.json({ error: 'Account is required for cash/bank payments' }, { status: 400 });
    }
    if (items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    // Validate items
    for (const it of items) {
      if (!it.item_name?.trim()) return NextResponse.json({ error: 'Each item must have a name' }, { status: 400 });
      if (!it.qty || Number(it.qty) <= 0) return NextResponse.json({ error: `Invalid quantity for ${it.item_name}` }, { status: 400 });
      if (it.unit_cost === undefined || Number(it.unit_cost) < 0) return NextResponse.json({ error: `Invalid cost for ${it.item_name}` }, { status: 400 });
    }

    if (account_id && payment_type !== 'credit') {
      const [acct] = await sql`SELECT id FROM accounts WHERE id = ${account_id} AND salon_id = ${user.salon_id} AND is_active = true`;
      if (!acct) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const subtotal       = items.reduce((s: number, it: any) => s + Number(it.qty) * Number(it.unit_cost), 0);
    const carriageAmt    = Math.max(0, Number(carriage_inward) || 0);
    const totalCost      = subtotal + carriageAmt;
    const status         = payment_type === 'credit' ? 'credit' : 'paid';

    // Create the purchase header
    const [purchase] = await sql`
      INSERT INTO purchases (
        salon_id, branch_id, supplier_id, purchase_date,
        payment_type, account_id, carriage_inward, subtotal, total_cost,
        notes, status, due_date, created_by
      ) VALUES (
        ${user.salon_id}, ${user.branch_id ?? null}, ${supplier_id || null},
        ${purchase_date}, ${payment_type},
        ${payment_type !== 'credit' ? account_id : null},
        ${carriageAmt}, ${subtotal}, ${totalCost},
        ${notes?.trim() || null}, ${status},
        ${payment_type === 'credit' ? (due_date || null) : null},
        ${user.id}
      ) RETURNING *`;

    // Create purchase_items + update stock
    for (const it of items) {
      const qty       = Number(it.qty);
      const unitCost  = Number(it.unit_cost);
      const lineTotal = qty * unitCost;
      const itemId    = it.item_id || null;

      await sql`
        INSERT INTO purchase_items (purchase_id, salon_id, item_id, item_name, unit, qty, unit_cost, line_total)
        VALUES (${purchase.id}, ${user.salon_id}, ${itemId}, ${it.item_name.trim()}, ${it.unit || 'pcs'}, ${qty}, ${unitCost}, ${lineTotal})`;

      // Update inventory if linked to a stock item
      if (itemId) {
        const [item] = await sql`SELECT id, current_qty FROM stock_items WHERE id = ${itemId} AND salon_id = ${user.salon_id}`;
        if (item) {
          const newQty = Number(item.current_qty) + qty;
          await sql`
            UPDATE stock_items
            SET current_qty = ${newQty}, cost_per_unit = ${unitCost}, updated_at = NOW()
            WHERE id = ${itemId}`;

          await sql`
            INSERT INTO stock_movements (salon_id, branch_id, item_id, qty_change, qty_after, reason, notes, created_by, reference_type, reference_id)
            VALUES (${user.salon_id}, ${user.branch_id ?? null}, ${itemId}, ${qty}, ${newQty}, 'purchase', ${`Purchase #${purchase.id.slice(0, 8)}`}, ${user.id}, 'purchase', ${purchase.id})`;
        }
      }
    }

    // Financial entry: deduct from account (if cash payment)
    if (payment_type !== 'credit' && totalCost > 0) {
      await sql`
        INSERT INTO account_transactions (salon_id, account_id, amount, direction, description, reference_type, reference_id, recorded_by, transaction_date)
        VALUES (${user.salon_id}, ${account_id}, ${Math.round(totalCost)}, 'out',
          ${supplier_id ? `Purchase from supplier` : 'Stock purchase'},
          'purchase', ${purchase.id}, ${user.id}, ${purchase_date})`;
    }

    // Financial entry: create payable (if credit)
    if (payment_type === 'credit' && totalCost > 0) {
      const supplierName = supplier_id
        ? (await sql`SELECT name FROM suppliers WHERE id = ${supplier_id}`)[0]?.name
        : null;

      await sql`
        INSERT INTO supplier_payables (salon_id, branch_id, supplier_id, description, amount, due_date, notes, purchase_id)
        VALUES (${user.salon_id}, ${user.branch_id ?? null}, ${supplier_id || null},
          ${supplierName ? `Stock purchase from ${supplierName}` : 'Stock purchase on credit'},
          ${totalCost}, ${due_date || null},
          ${notes?.trim() || null}, ${purchase.id})`;
    }

    return NextResponse.json(purchase, { status: 201 });
  } catch (err) {
    console.error('POST /api/purchases error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
