import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const fromDate = searchParams.get('from_date');
    const toDate   = searchParams.get('to_date');
    const period   = searchParams.get('period') || 'month';

    let fromISO: string, toISO: string;
    const now = new Date();
    toISO = now.toISOString();
    if (fromDate && toDate) {
      fromISO = `${fromDate}T00:00:00.000Z`;
      toISO   = `${toDate}T23:59:59.999Z`;
    } else if (period === 'today') {
      fromISO = new Date(now.toISOString().split('T')[0] + 'T00:00:00.000Z').toISOString();
    } else if (period === 'week') {
      const d = new Date(now); d.setDate(now.getDate() - now.getDay()); d.setHours(0, 0, 0, 0);
      fromISO = d.toISOString();
    } else {
      fromISO = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    }

    const branchId = user.branch_id;

    const workerList = await sql`
      SELECT w.id, w.name, w.phone, w.job_title, w.branch_id, b.name AS branch_name
      FROM workers w
      LEFT JOIN branches b ON b.id = w.branch_id
      WHERE w.salon_id = ${user.salon_id} AND w.is_active = true
        AND (${branchId}::uuid IS NULL OR w.branch_id = ${branchId}::uuid)
      ORDER BY w.name`;

    // Revenue from services — split equally among all workers on each service line
    const serviceRevenue = await sql`
      SELECT w.worker_id,
        SUM(vs.unit_price * vs.quantity / array_length(vs.worker_ids, 1))::numeric AS revenue,
        COUNT(DISTINCT vs.visit_id)::int AS visit_count
      FROM visit_services vs
      CROSS JOIN LATERAL unnest(vs.worker_ids) AS w(worker_id)
      JOIN visits v ON v.id = vs.visit_id
      WHERE v.salon_id = ${user.salon_id} AND v.is_active = true
        AND v.created_at >= ${fromISO} AND v.created_at <= ${toISO}
        AND (${branchId}::uuid IS NULL OR v.branch_id = ${branchId}::uuid)
        AND array_length(vs.worker_ids, 1) > 0
      GROUP BY w.worker_id`;

    // Add-on revenue — split equally among workers on the parent service
    const addonRevenue = await sql`
      SELECT w.worker_id,
        SUM(va.price_at_time * va.quantity / array_length(vs.worker_ids, 1))::numeric AS revenue
      FROM visit_addons va
      JOIN visit_services vs ON vs.id = va.visit_service_id
      CROSS JOIN LATERAL unnest(vs.worker_ids) AS w(worker_id)
      JOIN visits v ON v.id = vs.visit_id
      WHERE v.salon_id = ${user.salon_id} AND v.is_active = true
        AND v.created_at >= ${fromISO} AND v.created_at <= ${toISO}
        AND (${branchId}::uuid IS NULL OR v.branch_id = ${branchId}::uuid)
        AND array_length(vs.worker_ids, 1) > 0
      GROUP BY w.worker_id`;

    const ratings = await sql`
      SELECT worker_id, rating, comment, created_at FROM staff_ratings
      WHERE salon_id = ${user.salon_id} AND worker_id IS NOT NULL
        AND created_at >= ${fromISO} AND created_at <= ${toISO}`;

    const svcMap: Record<string, { revenue: number; visitCount: number }> = {};
    for (const r of serviceRevenue as any[])
      svcMap[r.worker_id] = { revenue: Number(r.revenue), visitCount: Number(r.visit_count) };

    const addMap: Record<string, number> = {};
    for (const r of addonRevenue as any[])
      addMap[r.worker_id] = Number(r.revenue);

    const ledger = workerList.map((member: any) => {
      const svc           = svcMap[member.id] ?? { revenue: 0, visitCount: 0 };
      const totalRevenue  = svc.revenue + (addMap[member.id] ?? 0);
      const memberRatings = (ratings as any[]).filter(r => r.worker_id === member.id);
      const avgRating     = memberRatings.length > 0
        ? memberRatings.reduce((s: number, r: any) => s + r.rating, 0) / memberRatings.length
        : null;
      return {
        id: member.id, name: member.name, phone: member.phone, job_title: member.job_title,
        branch_name:    member.branch_name ?? null,
        services_count: svc.visitCount,
        total_revenue:  totalRevenue,
        ratings_count:  memberRatings.length,
        avg_rating:     avgRating ? Math.round(avgRating * 10) / 10 : null,
        recent_ratings: memberRatings.slice(0, 5),
      };
    });

    return NextResponse.json({ ledger, period: { from: fromISO, to: toISO } });
  } catch (error) {
    console.error('Workers ledger error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
