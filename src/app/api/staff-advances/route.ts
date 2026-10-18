import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { checkAccountBalance } from '@/lib/accounts';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const status = request.nextUrl.searchParams.get('status');
    const branchId = user.branch_id;

    // staff_advances has no branch_id; filter by the staff member's branch
    const advances = status
      ? await sql`
          SELECT sa.id, sa.amount, sa.amount_repaid, sa.reason, sa.status, sa.created_at, sa.deducted_at, sa.staff_id, sa.given_by, sa.account_id
          FROM staff_advances sa
          JOIN workers st ON st.id = sa.staff_id
          WHERE sa.salon_id = ${user.salon_id} AND sa.status = ${status}
            AND (${branchId}::uuid IS NULL OR st.branch_id = ${branchId}::uuid)
          ORDER BY sa.created_at DESC`
      : await sql`
          SELECT sa.id, sa.amount, sa.amount_repaid, sa.reason, sa.status, sa.created_at, sa.deducted_at, sa.staff_id, sa.given_by, sa.account_id
          FROM staff_advances sa
          JOIN workers st ON st.id = sa.staff_id
          WHERE sa.salon_id = ${user.salon_id}
            AND (${branchId}::uuid IS NULL OR st.branch_id = ${branchId}::uuid)
          ORDER BY sa.created_at DESC`;

    if (!advances.length) return NextResponse.json([]);

    const staffIds = [...new Set(advances.map((a: any) => a.staff_id))];
    const staffList = await sql`SELECT id, name, branch_id FROM workers WHERE id = ANY(${staffIds as string[]})`;
    const staffMap: Record<string, { name: string; branch_id: string | null }> = {};
    for (const s of staffList as any[]) staffMap[s.id] = { name: s.name, branch_id: s.branch_id };

    // Resolve branch names
    const advBranchIds = [...new Set((staffList as any[]).map((s: any) => s.branch_id).filter(Boolean))] as string[];
    const branchMap: Record<string, string> = {};
    if (advBranchIds.length > 0) {
      const brRows = await sql`SELECT id, name FROM branches WHERE id = ANY(${advBranchIds})`;
      for (const b of brRows as any[]) branchMap[b.id] = b.name;
    }

    return NextResponse.json(advances.map((a: any) => {
      const st = staffMap[a.staff_id];
      return {
        ...a,
        staff_name:  st?.name ?? 'Unknown',
        branch_name: st?.branch_id ? (branchMap[st.branch_id] ?? null) : null,
      };
    }));
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

    const { staff_id, amount, reason, account_id } = await request.json();
    if (!staff_id) return NextResponse.json({ error: 'Staff member is required' }, { status: 400 });
    if (!amount || amount <= 0) return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    if (!account_id) return NextResponse.json({ error: 'Account the advance is paid from is required' }, { status: 400 });

    const [staffMember] = await sql`SELECT id, name FROM workers WHERE id = ${staff_id} AND salon_id = ${user.salon_id}`;
    if (!staffMember) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });

    const balanceCheck = await checkAccountBalance(account_id, user.salon_id, Math.round(Number(amount)));
    if (!balanceCheck.ok) return NextResponse.json({ error: balanceCheck.error }, { status: balanceCheck.status });
    const account = balanceCheck.account;

    const [advance] = await sql`
      INSERT INTO staff_advances (salon_id, staff_id, amount, reason, given_by, status, account_id)
      VALUES (${user.salon_id}, ${staff_id}, ${Math.round(Number(amount))}, ${reason?.trim() || null}, ${user.id}, 'pending', ${account.id})
      RETURNING *`;

    // Record the cash-out from the account the advance was actually paid from
    // (non-fatal — the advance itself is already recorded even if this fails)
    try {
      await sql`
        INSERT INTO account_transactions (salon_id, account_id, amount, direction, description, reference_type, reference_id, recorded_by, transaction_date)
        VALUES (${user.salon_id}, ${account.id}, ${Math.round(Number(amount))}, 'out', ${`Advance to ${staffMember.name}${reason ? ': ' + reason : ''}`}, 'advance', ${advance.id}, ${user.id}, ${new Date().toISOString().split('T')[0]})`;
    } catch (txErr) {
      console.warn('Failed to record advance transaction:', txErr);
    }

    return NextResponse.json({ ...advance, staff_name: staffMember.name }, { status: 201 });
  } catch (error) {
    console.error('Staff advances POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
