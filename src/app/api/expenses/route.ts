import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

// ── GET /api/expenses ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const from   = searchParams.get('from_date');
    const to     = searchParams.get('to_date');
    const cat    = searchParams.get('category');
    const period = searchParams.get('period') || 'month';

    const supabase = await createClient();

    // Resolve date range
    let fromDate: string, toDate: string;
    const now = new Date();
    if (from && to) {
      fromDate = from; toDate = to;
    } else {
      switch (period) {
        case 'today':
          fromDate = toDate = now.toISOString().split('T')[0]; break;
        case 'week': {
          const d = new Date(now);
          d.setDate(d.getDate() - d.getDay());
          fromDate = d.toISOString().split('T')[0];
          toDate   = now.toISOString().split('T')[0];
          break;
        }
        case 'last_month': {
          const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          fromDate = d.toISOString().split('T')[0];
          toDate   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
          break;
        }
        case 'year':
          fromDate = `${now.getFullYear()}-01-01`;
          toDate   = now.toISOString().split('T')[0];
          break;
        default: // month
          fromDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
          toDate   = now.toISOString().split('T')[0];
      }
    }

    let query = supabase
      .from('expenses')
      .select('*, created_by_staff:staff!created_by(name)')
      .eq('salon_id', user.salon_id)
      .is('deleted_at', null)
      .gte('expense_date', fromDate)
      .lte('expense_date', toDate)
      .order('expense_date', { ascending: false });

    if (cat) query = query.eq('category', cat);

    const pmFilter = searchParams.get('payment_method');
    if (pmFilter) query = query.eq('payment_method', pmFilter);

    const { data, error } = await query;
    if (error) throw error;

    // Revenue for the same period (from account_transactions)
    const { data: revData } = await supabase
      .from('account_transactions')
      .select('amount')
      .eq('salon_id', user.salon_id)
      .eq('direction', 'in')
      .eq('reference_type', 'visit')
      .gte('transaction_date', fromDate)
      .lte('transaction_date', toDate);

    const totalRevenue  = (revData || []).reduce((s, r) => s + Number(r.amount), 0);
    const totalExpenses = (data || []).reduce((s, e) => s + Number(e.amount), 0);

    // Breakdowns
    const byCategory:      Record<string, number> = {};
    const byPaymentMethod: Record<string, number> = {};
    (data || []).forEach(e => {
      byCategory[e.category]           = (byCategory[e.category]           || 0) + Number(e.amount);
      byPaymentMethod[e.payment_method] = (byPaymentMethod[e.payment_method] || 0) + Number(e.amount);
    });

    return NextResponse.json({
      expenses: data || [],
      summary: {
        total:           totalExpenses,
        count:           (data || []).length,
        revenue:         totalRevenue,
        netProfit:       totalRevenue - totalExpenses,
        byCategory:      Object.entries(byCategory).map(([category, amount])           => ({ category, amount })),
        byPaymentMethod: Object.entries(byPaymentMethod).map(([method, amount])        => ({ method, amount })),
      },
      period: { from: fromDate, to: toDate },
    });
  } catch (err) {
    console.error('GET /api/expenses error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST /api/expenses ────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { category, amount, description, expense_date, payment_method } = body;

    if (!category?.trim()) return NextResponse.json({ error: 'Category is required' }, { status: 400 });
    if (!amount || Number(amount) <= 0) return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });

    const validPM = ['cash','mtn_mobile_money','airtel_money','other'];
    const pm = validPM.includes(payment_method) ? payment_method : 'cash';

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        salon_id:       user.salon_id,
        category:       category.trim(),
        amount:         Number(amount),
        description:    description?.trim() || null,
        expense_date:   expense_date || new Date().toISOString().split('T')[0],
        payment_method: pm,
        created_by:     user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('POST /api/expenses error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
