import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/workers/stats?worker_id=<id>&from_date=&to_date=
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const workerId = searchParams.get('worker_id');
    const fromDate = searchParams.get('from_date');
    const toDate   = searchParams.get('to_date');

    if (!workerId) return NextResponse.json({ error: 'worker_id required' }, { status: 400 });

    const fromISO = fromDate ? `${fromDate}T00:00:00.000Z` : '2000-01-01T00:00:00.000Z';
    const toISO   = toDate   ? `${toDate}T23:59:59.999Z`   : new Date().toISOString();

    const branchId = user.branch_id;

    // All-time revenue
    const [allTimeRow] = await sql`
      SELECT
        COALESCE(SUM(vs.unit_price * vs.quantity / array_length(vs.worker_ids, 1)), 0)::numeric AS service_revenue,
        COUNT(DISTINCT vs.visit_id)::int AS service_count
      FROM visit_services vs
      CROSS JOIN LATERAL unnest(vs.worker_ids) AS w(worker_id)
      JOIN visits v ON v.id = vs.visit_id
      WHERE v.salon_id = ${user.salon_id} AND v.is_active = true
        AND w.worker_id = ${workerId}::uuid
        AND (${branchId}::uuid IS NULL OR v.branch_id = ${branchId}::uuid)
        AND array_length(vs.worker_ids, 1) > 0
    `;

    const [allTimeAddonRow] = await sql`
      SELECT COALESCE(SUM(va.price_at_time * va.quantity / array_length(vs.worker_ids, 1)), 0)::numeric AS addon_revenue
      FROM visit_addons va
      JOIN visit_services vs ON vs.id = va.visit_service_id
      CROSS JOIN LATERAL unnest(vs.worker_ids) AS w(worker_id)
      JOIN visits v ON v.id = vs.visit_id
      WHERE v.salon_id = ${user.salon_id} AND v.is_active = true
        AND w.worker_id = ${workerId}::uuid
        AND (${branchId}::uuid IS NULL OR v.branch_id = ${branchId}::uuid)
        AND array_length(vs.worker_ids, 1) > 0
    `;

    // Period service breakdown
    const topServices = await sql`
      SELECT
        s.name AS service_name,
        s.category,
        COUNT(vs.id)::int AS count,
        COALESCE(SUM(vs.unit_price * vs.quantity / array_length(vs.worker_ids, 1)), 0)::numeric AS revenue
      FROM visit_services vs
      CROSS JOIN LATERAL unnest(vs.worker_ids) AS w(worker_id)
      JOIN visits v ON v.id = vs.visit_id
      JOIN services s ON s.id = vs.service_id
      WHERE v.salon_id = ${user.salon_id} AND v.is_active = true
        AND w.worker_id = ${workerId}::uuid
        AND v.created_at >= ${fromISO} AND v.created_at <= ${toISO}
        AND (${branchId}::uuid IS NULL OR v.branch_id = ${branchId}::uuid)
        AND array_length(vs.worker_ids, 1) > 0
      GROUP BY s.id, s.name, s.category
      ORDER BY count DESC
      LIMIT 10
    `;

    // Rating history
    const ratings = await sql`
      SELECT rating, comment, created_at
      FROM staff_ratings
      WHERE salon_id = ${user.salon_id} AND worker_id = ${workerId}::uuid
      ORDER BY created_at DESC
      LIMIT 20
    `;

    const ratingList = ratings as any[];
    const distribution = [1, 2, 3, 4, 5].map(star => ({
      star,
      count: ratingList.filter(r => r.rating === star).length,
    }));

    return NextResponse.json({
      allTimeRevenue:    Number(allTimeRow.service_revenue) + Number(allTimeAddonRow.addon_revenue),
      allTimeServices:   Number(allTimeRow.service_count),
      topServices:       (topServices as any[]).map(r => ({
        service_name: r.service_name,
        category:     r.category,
        count:        Number(r.count),
        revenue:      Number(r.revenue),
      })),
      recentRatings: ratingList.slice(0, 10).map(r => ({
        rating:     r.rating,
        comment:    r.comment || null,
        created_at: r.created_at,
      })),
      ratingDistribution: distribution,
    });
  } catch (error) {
    console.error('Worker stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
