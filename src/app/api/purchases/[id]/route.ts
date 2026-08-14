import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// GET /api/purchases/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const [purchase] = await sql`
      SELECT p.*, sup.name AS supplier_name, a.name AS account_name
      FROM purchases p
      LEFT JOIN suppliers sup ON sup.id = p.supplier_id
      LEFT JOIN accounts  a   ON a.id   = p.account_id
      WHERE p.id = ${id} AND p.salon_id = ${user.salon_id}`;

    if (!purchase) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const items = await sql`
      SELECT pi.*, si.current_qty AS current_stock
      FROM purchase_items pi
      LEFT JOIN stock_items si ON si.id = pi.item_id
      WHERE pi.purchase_id = ${id}
      ORDER BY pi.created_at`;

    const [payable] = await sql`
      SELECT id, amount, amount_paid, status, due_date
      FROM supplier_payables
      WHERE purchase_id = ${id} AND salon_id = ${user.salon_id}
      LIMIT 1`;

    return NextResponse.json({ ...purchase, items, payable: payable ?? null });
  } catch (err) {
    console.error('GET /api/purchases/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/purchases/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;

    const [purchase] = await sql`
      SELECT p.*, sp.id AS payable_id, sp.status AS payable_status
      FROM purchases p
      LEFT JOIN supplier_payables sp ON sp.purchase_id = p.id
      WHERE p.id = ${id} AND p.salon_id = ${user.salon_id}`;

    if (!purchase) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Reverse inventory movements created by this purchase
    const purchaseItems = await sql`SELECT * FROM purchase_items WHERE purchase_id = ${id}`;

    for (const it of purchaseItems as any[]) {
      if (it.item_id) {
        const [item] = await sql`SELECT id, current_qty FROM stock_items WHERE id = ${it.item_id}`;
        if (item) {
          const newQty = Math.max(0, Number(item.current_qty) - Number(it.qty));
          await sql`UPDATE stock_items SET current_qty = ${newQty}, updated_at = NOW() WHERE id = ${it.item_id}`;
          await sql`
            INSERT INTO stock_movements (salon_id, branch_id, item_id, qty_change, qty_after, reason, notes, created_by, reference_type, reference_id)
            VALUES (${user.salon_id}, ${user.branch_id ?? null}, ${it.item_id}, ${-Number(it.qty)}, ${newQty},
              'adjustment', ${'Reversed: deleted purchase'}, ${user.id}, 'purchase', ${id})`;
        }
      }
    }

    // Remove account transaction for cash/bank purchases
    await sql`DELETE FROM account_transactions WHERE reference_type = 'purchase' AND reference_id = ${id} AND salon_id = ${user.salon_id}`;

    // Remove payable and any account transactions made when settling it
    if (purchase.payable_id) {
      await sql`DELETE FROM account_transactions WHERE reference_type = 'payable' AND reference_id = ${purchase.payable_id} AND salon_id = ${user.salon_id}`;
      await sql`DELETE FROM supplier_payables WHERE id = ${purchase.payable_id}`;
    }

    await sql`DELETE FROM purchases WHERE id = ${id} AND salon_id = ${user.salon_id}`;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/purchases/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
