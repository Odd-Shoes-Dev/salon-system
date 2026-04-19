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

    const { data, error } = await query;
    if (error) throw error;

    // Summary
    const totalExpenses = (data || []).reduce((s, e) => s + Number(e.amount), 0);
    const byCategory: Record<string, number> = {};
    (data || []).forEach(e => {
      byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
    });

    return NextResponse.json({
      expenses: data || [],
      summary: {
        total: totalExpenses,
        count: (data || []).length,
        byCategory: Object.entries(byCategory).map(([category, amount]) => ({ category, amount })),
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
    const { category, amount, description, expense_date } = body;

    if (!category?.trim()) return NextResponse.json({ error: 'Category is required' }, { status: 400 });
    if (!amount || Number(amount) <= 0) return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        salon_id:     user.salon_id,
        category:     category.trim(),
        amount:       Number(amount),
        description:  description?.trim() || null,
        expense_date: expense_date || new Date().toISOString().split('T')[0],
        created_by:   user.id,
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
