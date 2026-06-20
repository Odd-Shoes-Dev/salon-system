import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/visits/[id] - Fetch visit service lines + workers for staff edit modal
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const services = await sql`
      SELECT vs.id, vs.worker_ids, vs.unit_price, vs.quantity,
             svc.name AS service_name
      FROM visit_services vs
      JOIN services svc ON svc.id = vs.service_id
      JOIN visits v ON v.id = vs.visit_id
      WHERE vs.visit_id = ${id} AND v.salon_id = ${user.salon_id}
      ORDER BY vs.created_at`;

    const workers = await sql`
      SELECT id, name, job_title FROM workers
      WHERE salon_id = ${user.salon_id} AND is_active = true
      ORDER BY name`;

    return NextResponse.json({ services, workers });
  } catch (error) {
    console.error('Visits GET [id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/visits/[id] - Reassign staff per service line (owner/admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const { service_assignments } = await request.json();

    const [visit] = await sql`
      SELECT id FROM visits
      WHERE id = ${id} AND salon_id = ${user.salon_id} AND is_active = true`;
    if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });

    for (const { visit_service_id, worker_ids } of service_assignments) {
      await sql`
        UPDATE visit_services
        SET worker_ids = ${worker_ids as string[]}
        WHERE id = ${visit_service_id} AND visit_id = ${id}`;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Visits PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/visits/[id] - Record a balance payment against an existing visit
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { payment_amount, payment_method } = body;

    const paymentAmt = Number(payment_amount);
    if (!payment_amount || paymentAmt <= 0) {
      return NextResponse.json({ error: 'Invalid payment amount' }, { status: 400 });
    }

    const [visit] = await sql`
      SELECT v.*, c.name AS client_name, c.phone AS client_phone
      FROM visits v
      JOIN clients c ON c.id = v.client_id
      WHERE v.id = ${id} AND v.salon_id = ${user.salon_id} AND v.is_active = true`;

    if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    if (Number(visit.balance_due) <= 0) {
      return NextResponse.json({ error: 'No outstanding balance on this visit' }, { status: 400 });
    }

    const addedPayment = Math.min(paymentAmt, Number(visit.balance_due));
    const newAmountPaid = Number(visit.amount_paid) + addedPayment;
    const newBalanceDue = Math.max(0, Number(visit.balance_due) - addedPayment);
    const newStatus = newBalanceDue === 0 ? 'paid' : 'partial';

    await sql`
      UPDATE visits
      SET amount_paid = ${newAmountPaid},
          balance_due = ${newBalanceDue},
          payment_status = ${newStatus},
          updated_at = NOW()
      WHERE id = ${id} AND salon_id = ${user.salon_id}`;

    // Record account transaction for the balance payment
    try {
      const pm = payment_method || visit.payment_method;
      const [acct] = await sql`SELECT id FROM accounts WHERE salon_id = ${user.salon_id} AND type = ${pm} AND is_system = true`;
      if (acct) {
        await sql`INSERT INTO account_transactions
          (salon_id, account_id, amount, direction, description, reference_type, reference_id, recorded_by, transaction_date)
          VALUES (${user.salon_id}, ${acct.id}, ${addedPayment}, 'in',
            ${'Balance payment – Receipt ' + visit.receipt_number}, 'visit', ${visit.id},
            ${user.id}, ${new Date().toISOString().split('T')[0]})
          ON CONFLICT (salon_id, reference_id)
          DO UPDATE SET amount = account_transactions.amount + ${addedPayment},
                        description = ${'Balance payment – Receipt ' + visit.receipt_number},
                        updated_at = NOW()`;
      }
    } catch (accErr) {
      console.error('Account transaction error (non-fatal):', accErr);
    }

    return NextResponse.json({
      id: visit.id,
      receipt_number: visit.receipt_number,
      total_amount: Number(visit.total_amount),
      checkout_discount: Number(visit.checkout_discount || 0),
      previous_amount_paid: Number(visit.amount_paid),
      amount_paid: newAmountPaid,
      balance_due: newBalanceDue,
      payment_status: newStatus,
      payment_amount: addedPayment,
      payment_method: payment_method || visit.payment_method,
      client_name: visit.client_name,
      client_phone: visit.client_phone,
      created_at: visit.created_at,
    });
  } catch (error) {
    console.error('Visits PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/visits/[id] - Soft delete a transaction
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can void transactions' }, { status: 403 });
    }

    const { id } = await params;

    const [visit] = await sql`
      SELECT id, client_id, total_amount, points_earned, is_active FROM visits
      WHERE id = ${id} AND salon_id = ${user.salon_id}`;

    if (!visit || !visit.is_active) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const [client] = await sql`
      SELECT id, loyalty_points, total_spent, total_visits FROM clients
      WHERE id = ${visit.client_id} AND salon_id = ${user.salon_id}`;

    if (!client) return NextResponse.json({ error: 'Related client not found' }, { status: 404 });

    await sql`
      UPDATE visits SET
        is_active = false, status = 'voided',
        voided_at = NOW(), voided_by = ${user.id},
        deleted_at = NOW(), deleted_by = ${user.id}, updated_at = NOW()
      WHERE id = ${id} AND salon_id = ${user.salon_id} AND is_active = true`;

    const nextPoints    = Math.max(0, Number(client.loyalty_points || 0) - Number(visit.points_earned || 0));
    const nextTotalSpent = Math.max(0, Number(client.total_spent || 0) - Number(visit.total_amount || 0));
    const nextVisits    = Math.max(0, Number(client.total_visits || 0) - 1);

    await sql`
      UPDATE clients SET
        loyalty_points = ${nextPoints},
        total_spent    = ${nextTotalSpent},
        total_visits   = ${nextVisits},
        updated_at     = NOW()
      WHERE id = ${client.id} AND salon_id = ${user.salon_id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Visits DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
