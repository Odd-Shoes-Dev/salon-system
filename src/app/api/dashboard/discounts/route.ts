import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

// GET /api/dashboard/discounts?period=today|week|month|all
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const period = params.get('period') || 'today';
    const fromDateParam = params.get('from_date');
    const toDateParam = params.get('to_date');
    const supabase = await createClient();

    let periodStart: string;
    let periodEnd: string | null = null;
    const now = new Date();

    if (fromDateParam && toDateParam) {
      periodStart = `${fromDateParam}T00:00:00.000Z`;
      periodEnd   = `${toDateParam}T23:59:59.999Z`;
    } else if (period === 'today') {
      periodStart = now.toISOString().split('T')[0] + 'T00:00:00.000Z';
    } else if (period === 'week') {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      periodStart = weekStart.toISOString();
    } else if (period === 'month') {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    } else if (period === 'last_month') {
      periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      periodEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).toISOString();
    } else {
      periodStart = '2000-01-01T00:00:00.000Z';
    }

    // Get visit IDs for the salon within the period
    let visitQuery = supabase
      .from('visits')
      .select('id')
      .eq('salon_id', user.salon_id)
      .eq('is_active', true)
      .gte('created_at', periodStart);

    if (periodEnd) visitQuery = visitQuery.lte('created_at', periodEnd);

    const { data: visits } = await visitQuery;

    const visitIds = (visits || []).map((v: any) => v.id);

    if (visitIds.length === 0) {
      return NextResponse.json({ totalDiscountAmount: 0, discountCount: 0 });
    }

    // Sum discount_amount across all visit_services for those visits
    const { data: discountRows } = await supabase
      .from('visit_services')
      .select('discount_amount')
      .in('visit_id', visitIds)
      .gt('discount_amount', 0);

    const totalDiscountAmount = (discountRows || []).reduce(
      (sum: number, row: any) => sum + Number(row.discount_amount || 0),
      0
    );

    return NextResponse.json({
      totalDiscountAmount,
      discountCount: (discountRows || []).length,
    });
  } catch (error) {
    console.error('Dashboard discounts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
