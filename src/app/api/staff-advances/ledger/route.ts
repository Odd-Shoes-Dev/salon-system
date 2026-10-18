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

    // Format dates as plain text in East Africa Time, in SQL — the driver
    // returns timestamptz columns as JS Date objects (not strings), so
    // sorting/comparing them with string methods like .localeCompare fails,
    // and converting them with .toISOString() shifts by the UTC offset
    // instead of giving back the local calendar date.
    const advances = await sql`
      SELECT id, to_char(created_at AT TIME ZONE 'Africa/Nairobi', 'YYYY-MM-DD') AS date, reason, amount
      FROM staff_advances
      WHERE staff_id = ${staffId} AND salon_id = ${user.salon_id} AND status != 'cancelled'
      ORDER BY created_at ASC`;

    const repayments = await sql`
      SELECT sar.id, to_char(sar.repaid_at AT TIME ZONE 'Africa/Nairobi', 'YYYY-MM-DD') AS date, sar.amount, sar.method
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
