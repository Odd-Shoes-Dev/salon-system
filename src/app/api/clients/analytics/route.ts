import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/clients/analytics?client_id=<id>
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const clientId = searchParams.get('client_id');
    if (!clientId) return NextResponse.json({ error: 'client_id required' }, { status: 400 });

    // Monthly spend trend — last 12 months
    const monthlySpend = await sql`
      SELECT
        TO_CHAR(v.created_at AT TIME ZONE 'UTC', 'YYYY-MM') AS month,
        COALESCE(SUM(v.total_amount - COALESCE(v.checkout_discount, 0)), 0)::numeric AS revenue,
        COUNT(v.id)::int                                      AS visits
      FROM visits v
      WHERE v.salon_id = ${user.salon_id}
        AND v.client_id = ${clientId}::uuid
        AND v.is_active = true
        AND v.created_at >= NOW() - INTERVAL '12 months'
      GROUP BY month
      ORDER BY month ASC
    `;

    // All-time service preference breakdown
    const servicePrefs = await sql`
      SELECT
        s.name AS service_name,
        s.category,
        COUNT(vs.id)::int AS count,
        COALESCE(SUM(vs.unit_price * vs.quantity), 0)::numeric AS revenue
      FROM visit_services vs
      JOIN visits v ON v.id = vs.visit_id
      JOIN services s ON s.id = vs.service_id
      WHERE v.salon_id = ${user.salon_id}
        AND v.client_id = ${clientId}::uuid
        AND v.is_active = true
      GROUP BY s.id, s.name, s.category
      ORDER BY count DESC
      LIMIT 8
    `;

    // Visit dates for frequency calculation
    const visitDates = await sql`
      SELECT created_at
      FROM visits
      WHERE salon_id = ${user.salon_id}
        AND client_id = ${clientId}::uuid
        AND is_active = true
      ORDER BY created_at DESC
      LIMIT 50
    `;

    const dates = (visitDates as any[]).map(r => new Date(r.created_at));
    let avgDaysBetween: number | null = null;
    if (dates.length >= 2) {
      let totalGap = 0;
      for (let i = 0; i < dates.length - 1; i++) {
        totalGap += (dates[i].getTime() - dates[i + 1].getTime()) / (1000 * 60 * 60 * 24);
      }
      avgDaysBetween = Math.round(totalGap / (dates.length - 1));
    }

    const lastVisitDate  = dates[0] ?? null;
    const daysSinceLast  = lastVisitDate
      ? Math.floor((Date.now() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // At-risk: overdue by more than 1.5× their average gap
    const isAtRisk = avgDaysBetween !== null && daysSinceLast !== null
      ? daysSinceLast > avgDaysBetween * 1.5
      : false;

    return NextResponse.json({
      monthlySpend: (monthlySpend as any[]).map(r => ({
        month:   r.month,
        revenue: Number(r.revenue),
        visits:  Number(r.visits),
      })),
      servicePreferences: (servicePrefs as any[]).map(r => ({
        service_name: r.service_name,
        category:     r.category,
        count:        Number(r.count),
        revenue:      Number(r.revenue),
      })),
      visitFrequency: {
        avgDaysBetween,
        daysSinceLast,
        isAtRisk,
        totalVisits: dates.length,
      },
    });
  } catch (error) {
    console.error('Client analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
