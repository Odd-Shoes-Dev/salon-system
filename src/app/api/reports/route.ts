import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const params = request.nextUrl.searchParams;
    const period = params.get('period') || 'month';
    let fromDate = params.get('from_date');
    let toDate = params.get('to_date');

    // Derive date range from period preset
    if (!fromDate || !toDate) {
      const now = new Date();
      toDate = now.toISOString().split('T')[0];
      if (period === 'week') {
        const d = new Date(now);
        d.setDate(d.getDate() - 6);
        fromDate = d.toISOString().split('T')[0];
      } else if (period === 'month') {
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      } else if (period === 'last_month') {
        const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const last = new Date(now.getFullYear(), now.getMonth(), 0);
        fromDate = first.toISOString().split('T')[0];
        toDate = last.toISOString().split('T')[0];
      } else if (period === '3months') {
        const d = new Date(now);
        d.setMonth(d.getMonth() - 3);
        fromDate = d.toISOString().split('T')[0];
      } else if (period === 'year') {
        fromDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      } else {
        // default: this month
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      }
    }

    const supabase = await createClient();

    // ── Fetch all visits in range ──────────────────────────────────────────
    const { data: visits, error: visitsError } = await supabase
      .from('visits')
      .select(`
        id, created_at, total_amount, payment_method, points_earned,
        client:clients(id, name, phone),
        visit_services(
          quantity, unit_price,
          service:services(id, name, category)
        )
      `)
      .eq('salon_id', user.salon_id)
      .eq('is_active', true)
      .gte('created_at', `${fromDate}T00:00:00.000Z`)
      .lte('created_at', `${toDate}T23:59:59.999Z`)
      .order('created_at', { ascending: true });

    if (visitsError) {
      console.error('Reports visits error:', visitsError);
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }

    const rows = visits || [];

    // ── Summary ───────────────────────────────────────────────────────────
    const totalRevenue = rows.reduce((s, v) => s + Number(v.total_amount || 0), 0);
    const totalVisits = rows.length;
    const avgOrderValue = totalVisits > 0 ? totalRevenue / totalVisits : 0;
    const uniqueClients = new Set(rows.map((v: any) => v.client?.id).filter(Boolean)).size;

    // ── Revenue by day ────────────────────────────────────────────────────
    const dayMap: Record<string, { date: string; revenue: number; visits: number }> = {};
    for (const v of rows) {
      const day = (v.created_at as string).split('T')[0];
      if (!dayMap[day]) dayMap[day] = { date: day, revenue: 0, visits: 0 };
      dayMap[day].revenue += Number(v.total_amount || 0);
      dayMap[day].visits += 1;
    }
    const revenueByDay = Object.values(dayMap);

    // ── Payment method breakdown ──────────────────────────────────────────
    const payMap: Record<string, { method: string; amount: number; count: number }> = {};
    for (const v of rows) {
      const m = v.payment_method || 'unknown';
      if (!payMap[m]) payMap[m] = { method: m, amount: 0, count: 0 };
      payMap[m].amount += Number(v.total_amount || 0);
      payMap[m].count += 1;
    }
    const paymentBreakdown = Object.values(payMap).sort((a, b) => b.amount - a.amount);

    // ── Top services ──────────────────────────────────────────────────────
    const svcMap: Record<string, { service_id: string; name: string; category: string; revenue: number; count: number }> = {};
    for (const v of rows) {
      for (const vs of (v.visit_services as any[]) || []) {
        const svc = vs.service;
        if (!svc) continue;
        if (!svcMap[svc.id]) svcMap[svc.id] = { service_id: svc.id, name: svc.name, category: svc.category || '', revenue: 0, count: 0 };
        svcMap[svc.id].revenue += Number(vs.unit_price || 0) * Number(vs.quantity || 1);
        svcMap[svc.id].count += Number(vs.quantity || 1);
      }
    }
    const topServices = Object.values(svcMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // ── Top clients ───────────────────────────────────────────────────────
    const clientMap: Record<string, { client_id: string; name: string; phone: string; total_spent: number; visits: number }> = {};
    for (const v of rows) {
      const c = v.client as any;
      if (!c) continue;
      if (!clientMap[c.id]) clientMap[c.id] = { client_id: c.id, name: c.name, phone: c.phone || '', total_spent: 0, visits: 0 };
      clientMap[c.id].total_spent += Number(v.total_amount || 0);
      clientMap[c.id].visits += 1;
    }
    const topClients = Object.values(clientMap).sort((a, b) => b.total_spent - a.total_spent).slice(0, 10);

    return NextResponse.json({
      period: { from: fromDate, to: toDate },
      summary: { totalRevenue, totalVisits, avgOrderValue, uniqueClients },
      revenueByDay,
      paymentBreakdown,
      topServices,
      topClients,
    });
  } catch (error) {
    console.error('Reports GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
