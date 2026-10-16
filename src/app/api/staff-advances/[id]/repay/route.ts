import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// POST /api/staff-advances/[id]/repay
// Body: { amount, method: 'cash'|'salary_deduction', account_id?, notes? }
//
// method='cash'            -> real money came back: Dr the account, Cr the receivable.
// method='salary_deduction' -> a contra entry: the receivable shrinks with NO cash
//   movement, because the staff member was paid less cash salary than the gross
//   expense recorded elsewhere. This system has no structured payroll module, so
//   it only clears the receivable side — whoever logs the salary expense is still
//   responsible for recording the actual (reduced) cash amount paid out.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Only owners and admins can record repayments' }, { status: 403 });
    }

    const { id } = await params;
    const { amount, method, account_id, notes } = await request.json();

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }
    if (!['cash', 'salary_deduction'].includes(method)) {
      return NextResponse.json({ error: 'method must be cash or salary_deduction' }, { status: 400 });
    }
    if (method === 'cash' && !account_id) {
      return NextResponse.json({ error: 'Account is required for a cash repayment' }, { status: 400 });
    }

    const [advance] = await sql`
      SELECT sa.*, w.name AS staff_name FROM staff_advances sa
      JOIN workers w ON w.id = sa.staff_id
      WHERE sa.id = ${id} AND sa.salon_id = ${user.salon_id}`;
    if (!advance) return NextResponse.json({ error: 'Advance not found' }, { status: 404 });
    if (!['pending', 'partial'].includes(advance.status)) {
      return NextResponse.json({ error: 'This advance is not open for repayment' }, { status: 400 });
    }

    const remaining = Number(advance.amount) - Number(advance.amount_repaid);
    const repayAmount = Math.round(Number(amount));
    if (repayAmount > remaining) {
      return NextResponse.json({ error: `Amount exceeds the remaining balance of ${remaining}` }, { status: 400 });
    }

    let resolvedAccountId: string | null = null;
    if (method === 'cash') {
      const [account] = await sql`SELECT id FROM accounts WHERE id = ${account_id} AND salon_id = ${user.salon_id} AND is_active = true`;
      if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      resolvedAccountId = account.id;
    }

    const [repayment] = await sql`
      INSERT INTO staff_advance_repayments (salon_id, advance_id, amount, method, account_id, notes, recorded_by)
      VALUES (${user.salon_id}, ${id}, ${repayAmount}, ${method}, ${resolvedAccountId}, ${notes?.trim() || null}, ${user.id})
      RETURNING *`;

    const newAmountRepaid = Number(advance.amount_repaid) + repayAmount;
    const newStatus = newAmountRepaid >= Number(advance.amount) ? 'deducted' : 'partial';
    const deductedAt = newStatus === 'deducted' ? new Date().toISOString() : advance.deducted_at;

    const [updated] = await sql`
      UPDATE staff_advances
      SET amount_repaid = ${newAmountRepaid},
          status = ${newStatus},
          deducted_at = ${deductedAt}
      WHERE id = ${id} AND salon_id = ${user.salon_id}
      RETURNING *`;

    if (method === 'cash' && resolvedAccountId) {
      try {
        await sql`
          INSERT INTO account_transactions (salon_id, account_id, amount, direction, description, reference_type, reference_id, recorded_by, transaction_date)
          VALUES (${user.salon_id}, ${resolvedAccountId}, ${repayAmount}, 'in', ${`Advance repayment from ${advance.staff_name}`}, 'advance_repayment', ${repayment.id}, ${user.id}, ${new Date().toISOString().split('T')[0]})`;
      } catch (txErr) {
        console.warn('Failed to record advance repayment transaction:', txErr);
      }
    }

    return NextResponse.json({ advance: updated, repayment });
  } catch (error) {
    console.error('Staff advance repay error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
