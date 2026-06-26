import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// PUT /api/accounts/[id] — edit account details
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const [account] = await sql`SELECT * FROM accounts WHERE id = ${id} AND salon_id = ${user.salon_id}`;
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    if (account.is_system) {
      return NextResponse.json({ error: 'System accounts cannot be edited' }, { status: 403 });
    }

    const name = body.name?.trim() || account.name;
    const bank_name = 'bank_name' in body ? (body.bank_name?.trim() || null) : account.bank_name;
    const account_number = 'account_number' in body ? (body.account_number?.trim() || null) : account.account_number;
    const branch_name = 'branch_name' in body ? (body.branch_name?.trim() || null) : account.branch_name;

    try {
      const [data] = await sql`
        UPDATE accounts SET
          name = ${name},
          bank_name = ${bank_name},
          account_number = ${account_number},
          branch_name = ${branch_name},
          updated_at = NOW()
        WHERE id = ${id} AND salon_id = ${user.salon_id}
        RETURNING *`;
      return NextResponse.json(data);
    } catch (err: any) {
      if (err.code === '23505') return NextResponse.json({ error: 'An account with this name already exists' }, { status: 409 });
      throw err;
    }
  } catch (error) {
    console.error('Account PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/accounts/[id] — activate / deactivate
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const { is_active } = await request.json();

    const [account] = await sql`SELECT * FROM account_balances WHERE id = ${id} AND salon_id = ${user.salon_id}`;
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    if (account.is_system) {
      return NextResponse.json({ error: 'System accounts cannot be deactivated' }, { status: 403 });
    }

    // Prevent deactivation with non-zero balance
    if (is_active === false && Number(account.balance || 0) !== 0) {
      return NextResponse.json({ error: 'Transfer the remaining balance before deactivating this account' }, { status: 400 });
    }

    const [data] = await sql`
      UPDATE accounts SET is_active = ${is_active}, updated_at = NOW()
      WHERE id = ${id} AND salon_id = ${user.salon_id}
      RETURNING *`;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Account PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
