import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// GET /api/accounts/[id]/transactions?from=&to=&limit=50
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const sp    = request.nextUrl.searchParams;
    const from  = sp.get('from');
    const to    = sp.get('to');
    const limit = Math.min(parseInt(sp.get('limit') || '100', 10), 200);

    const supabase = await createClient();

    // Verify account belongs to salon
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', id)
      .eq('salon_id', user.salon_id)
      .single();

    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    let query = supabase
      .from('account_transactions')
      .select('id, amount, direction, description, reference_type, reference_id, transaction_date, created_at, recorded_by')
      .eq('account_id', id)
      .eq('salon_id', user.salon_id)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (from) query = query.gte('transaction_date', from);
    if (to)   query = query.lte('transaction_date', to);

    const { data, error } = await query;

    if (error) {
      console.error('Transactions GET error:', error);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Transactions GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/accounts/[id]/transactions — record a manual transaction
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const { amount, direction, description, transaction_date } = await request.json();

    if (!amount || amount <= 0) return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    if (!['in', 'out'].includes(direction)) return NextResponse.json({ error: 'direction must be in or out' }, { status: 400 });

    const supabase = await createClient();

    // Verify account belongs to salon
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', id)
      .eq('salon_id', user.salon_id)
      .single();

    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const { data, error } = await supabase
      .from('account_transactions')
      .insert({
        salon_id:         user.salon_id,
        account_id:       id,
        amount:           Math.round(Number(amount)),
        direction,
        description:      description?.trim() || null,
        reference_type:   'manual',
        recorded_by:      user.id,
        transaction_date: transaction_date || new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (error) {
      console.error('Transaction POST error:', error);
      return NextResponse.json({ error: 'Failed to record transaction' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Transaction POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
