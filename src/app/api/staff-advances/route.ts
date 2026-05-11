import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const status = request.nextUrl.searchParams.get('status');

    const advances = status
      ? await sql`
          SELECT id, amount, reason, status, created_at, deducted_at, staff_id, given_by
          FROM staff_advances
          WHERE salon_id = ${user.salon_id} AND status = ${status}
          ORDER BY created_at DESC`
      : await sql`
          SELECT id, amount, reason, status, created_at, deducted_at, staff_id, given_by
          FROM staff_advances
          WHERE salon_id = ${user.salon_id}
          ORDER BY created_at DESC`;

    if (!advances.length) return NextResponse.json([]);

    const staffIds = [...new Set(advances.map((a: any) => a.staff_id))];
    const staffList = await sql`SELECT id, name FROM staff WHERE id = ANY(${staffIds as string[]})`;
    const staffMap: Record<string, string> = {};
    for (const s of staffList as any[]) staffMap[s.id] = s.name;

    return NextResponse.json(advances.map((a: any) => ({ ...a, staff_name: staffMap[a.staff_id] || 'Unknown' })));
  } catch (error) {
    console.error('Staff advances GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Only owners and admins can give advances' }, { status: 403 });
    }

    const { staff_id, amount, reason } = await request.json();
    if (!staff_id) return NextResponse.json({ error: 'Staff member is required' }, { status: 400 });
    if (!amount || amount <= 0) return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });

    const [staffMember] = await sql`SELECT id, name FROM staff WHERE id = ${staff_id} AND salon_id = ${user.salon_id}`;
    if (!staffMember) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });

    const [advance] = await sql`
      INSERT INTO staff_advances (salon_id, staff_id, amount, reason, given_by, status)
      VALUES (${user.salon_id}, ${staff_id}, ${Math.round(Number(amount))}, ${reason?.trim() || null}, ${user.id}, 'pending')
      RETURNING *`;

    // Record cash-out transaction (non-fatal)
    try {
      const [cashAccount] = await sql`
        SELECT id FROM accounts WHERE salon_id = ${user.salon_id} AND type = 'cash' AND is_system = true`;
      if (cashAccount) {
        await sql`
          INSERT INTO account_transactions (salon_id, account_id, amount, direction, description, reference_type, reference_id, recorded_by, transaction_date)
          VALUES (${user.salon_id}, ${cashAccount.id}, ${Math.round(Number(amount))}, 'out', ${`Advance to ${staffMember.name}${reason ? ': ' + reason : ''}`}, 'advance', ${advance.id}, ${user.id}, ${new Date().toISOString().split('T')[0]})`;
      }
    } catch (txErr) {
      console.warn('Failed to record advance transaction:', txErr);
    }

    return NextResponse.json({ ...advance, staff_name: staffMember.name }, { status: 201 });
  } catch (error) {
    console.error('Staff advances POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
