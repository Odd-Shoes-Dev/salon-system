import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/visits/[id] - Fetch full visit data + service lines + addons + workers
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

    const [visit] = await sql`
      SELECT v.*, json_build_object('id', c.id, 'name', c.name, 'phone', c.phone) AS client
      FROM visits v
      JOIN clients c ON c.id = v.client_id
      WHERE v.id = ${id} AND v.salon_id = ${user.salon_id} AND v.is_active = true`;
    if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });

    const services = await sql`
      SELECT vs.id, vs.service_id, vs.worker_ids, vs.unit_price, vs.quantity,
             vs.original_price, vs.discount_amount,
             svc.name AS service_name
      FROM visit_services vs
      JOIN services svc ON svc.id = vs.service_id
      WHERE vs.visit_id = ${id}
      ORDER BY vs.created_at`;

    const addons = await sql`
      SELECT va.addon_id, va.quantity, va.price_at_time, sa.name
      FROM visit_addons va
      JOIN service_addons sa ON sa.id = va.addon_id
      WHERE va.visit_id = ${id}`;

    const workers = await sql`
      SELECT id, name, job_title FROM workers
      WHERE salon_id = ${user.salon_id} AND is_active = true
      ORDER BY name`;

    return NextResponse.json({
      visit,
      services: (services as any[]).map(s => ({
        id: s.id,
        service_id: s.service_id,
        service_name: s.service_name,
        unit_price: Number(s.unit_price),
        original_price: Number(s.original_price),
        quantity: s.quantity,
        worker_ids: s.worker_ids || [],
        discount_amount: Number(s.discount_amount || 0),
      })),
      addons: (addons as any[]).map(a => ({
        addon_id: a.addon_id,
        name: a.name,
        quantity: a.quantity,
        price: Number(a.price_at_time),
      })),
      workers,
    });
  } catch (error) {
    console.error('Visits GET [id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/visits/[id]
// Two modes:
//   1. Staff reassignment: body has { service_assignments }
//   2. Full same-day edit: body has { services, payment_method, ... }
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
    const body = await request.json();

    // ── Mode 1: Staff reassignment (existing) ────────────────
    if (body.service_assignments) {
      const [visit] = await sql`
        SELECT id FROM visits
        WHERE id = ${id} AND salon_id = ${user.salon_id} AND is_active = true`;
      if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });

      for (const { visit_service_id, worker_ids } of body.service_assignments) {
        await sql`
          UPDATE visit_services
          SET worker_ids = ${worker_ids as string[]}
          WHERE id = ${visit_service_id} AND visit_id = ${id}`;
      }
      return NextResponse.json({ success: true });
    }

    // ── Mode 2: Full same-day edit ───────────────────────────
    const { services, addons = [], payment_method, worker_ids: rawWorkerIds = [], checkout_discount: rawDiscount, amount_paid: rawAmountPaid } = body;
    if (!services || !Array.isArray(services) || services.length === 0) {
      return NextResponse.json({ error: 'Services are required' }, { status: 400 });
    }
    if (!payment_method) {
      return NextResponse.json({ error: 'Payment method is required' }, { status: 400 });
    }

    // Load the existing visit
    const [visit] = await sql`
      SELECT v.*, c.loyalty_points AS client_points, c.total_spent AS client_spent, c.total_visits AS client_visits
      FROM visits v
      JOIN clients c ON c.id = v.client_id
      WHERE v.id = ${id} AND v.salon_id = ${user.salon_id} AND v.is_active = true`;
    if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });

    // Same-day check
    const visitDate = new Date(visit.created_at).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    if (visitDate !== today) {
      return NextResponse.json({ error: 'Sales can only be edited on the same day they were recorded' }, { status: 403 });
    }

    // ── Reverse old client effects ──
    const oldPoints = Number(visit.points_earned || 0);
    const oldTotal = Number(visit.total_amount || 0);
    const clientPoints = Number(visit.client_points || 0);
    const clientSpent = Number(visit.client_spent || 0);

    // ── Calculate new totals ──
    interface SvcDetail { id: string; name: string; price: number; originalPrice: number; discountAmount: number; isDiscounted: boolean; quantity: number; workerIds: string[]; }
    const svcDetails: SvcDetail[] = [];
    let newTotal = 0;
    for (const item of services) {
      const [svc] = await sql`SELECT id, name, price FROM services WHERE id = ${item.service_id} AND salon_id = ${user.salon_id}`;
      if (!svc) continue;
      const qty = item.quantity || 1;
      const origPrice = Number(svc.price);
      const customPrice = item.custom_price !== undefined && item.custom_price !== null ? Number(item.custom_price) : origPrice;
      const discount = Math.max(0, origPrice - customPrice);
      newTotal += customPrice * qty;
      const svcWorkerIds: string[] = Array.isArray(item.worker_ids) ? item.worker_ids : [];
      svcDetails.push({ id: svc.id, name: svc.name, price: customPrice, originalPrice: origPrice, discountAmount: discount, isDiscounted: discount > 0, quantity: qty, workerIds: svcWorkerIds });
    }

    interface AddonDetail { addon_id: string; name: string; price: number; quantity: number; serviceIndex?: number; }
    const addonDetails: AddonDetail[] = [];
    for (const item of addons) {
      const [addon] = await sql`SELECT id, name, price FROM service_addons WHERE id = ${item.addon_id} AND salon_id = ${user.salon_id} AND is_active = true`;
      if (!addon) continue;
      const qty = item.quantity || 1;
      const price = item.custom_price !== undefined && item.custom_price !== null ? Math.max(0, Number(item.custom_price)) : Number(addon.price);
      newTotal += price * qty;
      addonDetails.push({ addon_id: addon.id, name: addon.name, price, quantity: qty, serviceIndex: item.service_index });
    }

    const [salon] = await sql`SELECT loyalty_points_per_ugx FROM salons WHERE id = ${user.salon_id}`;
    const loyaltyRate = salon?.loyalty_points_per_ugx || 10;
    const newPoints = svcDetails.reduce((sum, s) => {
      if (s.isDiscounted) return sum;
      return sum + Math.floor((s.price * s.quantity / 1000) * loyaltyRate);
    }, 0);

    const checkoutDiscount = Math.max(0, Number(rawDiscount) || 0);
    const amountDue = Math.max(0, newTotal - checkoutDiscount);
    const amountPaid = rawAmountPaid !== undefined && rawAmountPaid !== null
      ? Math.max(0, Math.min(Number(rawAmountPaid), amountDue))
      : amountDue;
    const balanceDue = Math.max(0, amountDue - amountPaid);
    const paymentStatus = balanceDue === 0 ? 'paid' : 'partial';

    const workerIds: string[] = Array.isArray(rawWorkerIds) ? rawWorkerIds : [];
    const primaryWorkerId = workerIds[0] || null;

    // ── Delete old line items ──
    await sql`DELETE FROM visit_addons WHERE visit_id = ${id}`;
    await sql`DELETE FROM visit_services WHERE visit_id = ${id}`;
    await sql`DELETE FROM visit_workers WHERE visit_id = ${id}`;

    // ── Insert new line items ──
    const visitServiceIds: string[] = [];
    for (const s of svcDetails) {
      const [vs] = await sql`
        INSERT INTO visit_services (visit_id, service_id, quantity, price, unit_price, original_price, discount_amount, discounted_by, worker_ids)
        VALUES (${id}, ${s.id}, ${s.quantity}, ${s.price}, ${s.price}, ${s.originalPrice}, ${s.discountAmount}, ${s.isDiscounted ? user.id : null}, ${s.workerIds})
        RETURNING id`;
      visitServiceIds.push(vs.id);
    }

    for (const a of addonDetails) {
      const vsId = a.serviceIndex !== undefined && visitServiceIds[a.serviceIndex] ? visitServiceIds[a.serviceIndex] : null;
      await sql`INSERT INTO visit_addons (visit_id, addon_id, salon_id, quantity, price_at_time, visit_service_id) VALUES (${id}, ${a.addon_id}, ${user.salon_id}, ${a.quantity}, ${a.price}, ${vsId})`;
    }

    for (const wid of workerIds) {
      await sql`INSERT INTO visit_workers (visit_id, worker_id, salon_id) VALUES (${id}, ${wid}, ${user.salon_id}) ON CONFLICT DO NOTHING`;
    }

    // ── Update visit record ──
    await sql`
      UPDATE visits
      SET total_amount = ${newTotal}, payment_method = ${payment_method}, points_earned = ${newPoints},
          worker_id = ${primaryWorkerId}, checkout_discount = ${checkoutDiscount},
          amount_paid = ${amountPaid}, balance_due = ${balanceDue}, payment_status = ${paymentStatus},
          edited_at = NOW(), edited_by = ${user.id}, updated_at = NOW()
      WHERE id = ${id} AND salon_id = ${user.salon_id}`;

    // ── Update client totals (reverse old, apply new) ──
    const adjustedPoints = Math.max(0, clientPoints - oldPoints + newPoints);
    const adjustedSpent = Math.max(0, clientSpent - oldTotal + newTotal);
    await sql`
      UPDATE clients
      SET loyalty_points = ${adjustedPoints}, total_spent = ${adjustedSpent}, updated_at = NOW()
      WHERE id = ${visit.client_id} AND salon_id = ${user.salon_id}`;

    // ── Update account transaction (reverse old, record new) ──
    try {
      await sql`DELETE FROM account_transactions WHERE reference_type = 'visit' AND reference_id = ${id} AND salon_id = ${user.salon_id}`;
      const [acct] = await sql`SELECT id FROM accounts WHERE salon_id = ${user.salon_id} AND type = ${payment_method} AND is_system = true`;
      if (acct && amountPaid > 0) {
        await sql`INSERT INTO account_transactions (salon_id, account_id, amount, direction, description, reference_type, reference_id, recorded_by, transaction_date)
          VALUES (${user.salon_id}, ${acct.id}, ${amountPaid}, 'in', ${`Receipt ${visit.receipt_number} (edited)`}, 'visit', ${id}, ${user.id}, ${today})`;
      }
    } catch (accErr) {
      console.error('Account transaction update error (non-fatal):', accErr);
    }

    return NextResponse.json({
      success: true,
      visit_id: id,
      receipt_number: visit.receipt_number,
      total_amount: newTotal,
      points_earned: newPoints,
      payment_method,
      checkout_discount: checkoutDiscount,
      amount_paid: amountPaid,
      balance_due: balanceDue,
    });
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
