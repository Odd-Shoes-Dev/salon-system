import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    if (body.action === 'record_payment') {
      const payment   = Number(body.payment);
      const accountId = body.account_id || null;
      const payDate   = body.payment_date || new Date().toISOString().slice(0, 10);

      if (!payment || payment <= 0) return NextResponse.json({ error: 'Invalid payment amount' }, { status: 400 });

      const [current] = await sql`
        SELECT sp.*, sup.name AS supplier_name
        FROM supplier_payables sp
        LEFT JOIN suppliers sup ON sup.id = sp.supplier_id
        WHERE sp.id = ${id} AND sp.salon_id = ${user.salon_id}`;

      if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const newPaid  = Math.min(Number(current.amount_paid) + payment, Number(current.amount));
      const newStatus = newPaid >= Number(current.amount) ? 'paid' : 'partial';

      const [item] = await sql`
        UPDATE supplier_payables SET
          amount_paid = ${newPaid},
          status      = ${newStatus},
          paid_at     = CASE WHEN ${newStatus} = 'paid' THEN NOW() ELSE paid_at END,
          updated_at  = NOW()
        WHERE id = ${id} AND salon_id = ${user.salon_id}
        RETURNING *`;

      // Deduct from account if one is specified
      if (accountId) {
        const [acct] = await sql`SELECT id FROM accounts WHERE id = ${accountId} AND salon_id = ${user.salon_id}`;
        if (acct) {
          const desc = current.supplier_name
            ? `Payment to ${current.supplier_name}`
            : 'Supplier payment';
          await sql`
            INSERT INTO account_transactions (salon_id, account_id, amount, direction, description, reference_type, reference_id, recorded_by, transaction_date)
            VALUES (${user.salon_id}, ${accountId}, ${Math.round(payment)}, 'out', ${desc}, 'payable', ${id}, ${user.id}, ${payDate})`;
        }
      }

      // Sync purchase status when payable is fully paid
      if (newStatus === 'paid' && current.purchase_id) {
        await sql`
          UPDATE purchases SET status = 'paid', updated_at = NOW()
          WHERE id = ${current.purchase_id} AND salon_id = ${user.salon_id}`;
      }

      return NextResponse.json(item);
    }

    const { supplier_id, equipment_id, description, amount, due_date, notes } = body;
    const [item] = await sql`
      UPDATE supplier_payables SET
        supplier_id  = ${supplier_id || null},
        equipment_id = ${equipment_id || null},
        description  = ${description?.trim()},
        amount       = ${Number(amount)},
        due_date     = ${due_date || null},
        notes        = ${notes?.trim() || null},
        updated_at   = NOW()
      WHERE id = ${id} AND salon_id = ${user.salon_id}
      RETURNING *`;

    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(item);
  } catch (err) {
    console.error('PUT /api/inventory/payables/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    // Reverse any account transactions made when settling this payable
    await sql`DELETE FROM account_transactions WHERE reference_type = 'payable' AND reference_id = ${id} AND salon_id = ${user.salon_id}`;
    await sql`DELETE FROM supplier_payables WHERE id = ${id} AND salon_id = ${user.salon_id}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/inventory/payables/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
