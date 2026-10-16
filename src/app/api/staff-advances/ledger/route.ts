import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/staff-advances/ledger?staff_id=X
// Debtors ledger for one staff member: every advance given (Dr — increases
// what they owe) and every repayment (Cr — decreases it), chronological,
// with a running balance. Mirrors a textbook T-account/column ledger.
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const staffId = request.nextUrl.searchParams.get('staff_id');
    if (!staffId) return NextResponse.json({ error: 'staff_id is required' }, { status: 400 });

    const [staffMember] = await sql`SELECT id, name FROM workers WHERE id = ${staffId} AND salon_id = ${user.salon_id}`;
    if (!staffMember) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });

    const advances = await sql`
      SELECT id, created_at::date AS date, reason, amount
      FROM staff_advances
      WHERE staff_id = ${staffId} AND salon_id = ${user.salon_id} AND status != 'cancelled'
      ORDER BY created_at ASC`;

    const repayments = await sql`
      SELECT sar.id, sar.repaid_at::date AS date, sar.amount, sar.method
      FROM staff_advance_repayments sar
      JOIN staff_advances sa ON sa.id = sar.advance_id
      WHERE sa.staff_id = ${staffId} AND sa.salon_id = ${user.salon_id}
      ORDER BY sar.repaid_at ASC`;

    type Entry = { date: string; particulars: string; dr: number; cr: number };
    const entries: Entry[] = [
      ...(advances as any[]).map(a => ({
        date: a.date,
        particulars: `Advance given${a.reason ? `: ${a.reason}` : ''}`,
        dr: Number(a.amount),
        cr: 0,
      })),
      ...(repayments as any[]).map(r => ({
        date: r.date,
        particulars: r.method === 'cash' ? 'Repayment (cash)' : 'Repayment (salary deduction)',
        dr: 0,
        cr: Number(r.amount),
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    let balance = 0;
    const rows = entries.map(e => {
      balance += e.dr - e.cr;
      return { ...e, balance };
    });

    return NextResponse.json({
      staff_name: staffMember.name,
      entries: rows,
      closing_balance: balance,
    });
  } catch (error) {
    console.error('Staff advances ledger error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
