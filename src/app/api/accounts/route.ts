import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

// GET /api/accounts — list all accounts with running balances
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('account_balances')
      .select('*')
      .eq('salon_id', user.salon_id)
      .eq('is_active', true)
      .order('sort_order');

    if (error) {
      console.error('Accounts GET error:', error);
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Accounts GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/accounts — create a new expense account
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { name } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Account name is required' }, { status: 400 });

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('accounts')
      .insert({
        salon_id:   user.salon_id,
        name:       name.trim(),
        type:       'expense',
        is_system:  false,
        sort_order: 99,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'An account with this name already exists' }, { status: 409 });
      console.error('Accounts POST error:', error);
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Accounts POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
