import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/accounts
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await sql`
      SELECT * FROM account_balances
      WHERE salon_id = ${user.salon_id}
      ORDER BY is_active DESC, sort_order`;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Accounts GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/accounts
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { name, type, bank_name, account_number, branch_name } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Account name is required' }, { status: 400 });

    const accountType = type === 'bank' ? 'bank' : 'expense';

    try {
      const [data] = await sql`
        INSERT INTO accounts (salon_id, name, type, is_system, sort_order, bank_name, account_number, branch_name)
        VALUES (${user.salon_id}, ${name.trim()}, ${accountType}, false, 99, ${bank_name?.trim() || null}, ${account_number?.trim() || null}, ${branch_name?.trim() || null})
        RETURNING *`;
      return NextResponse.json(data, { status: 201 });
    } catch (err: any) {
      if (err.code === '23505') return NextResponse.json({ error: 'An account with this name already exists' }, { status: 409 });
      throw err;
    }
  } catch (error) {
    console.error('Accounts POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
