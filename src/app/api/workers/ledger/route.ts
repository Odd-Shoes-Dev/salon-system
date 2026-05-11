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

    const workerList = await sql`
      SELECT id, name, phone, job_title FROM workers
      WHERE salon_id = ${user.salon_id} AND is_active = true ORDER BY name`;

    const visits = await sql`
      SELECT id, worker_id, total_amount FROM visits
      WHERE salon_id = ${user.salon_id} AND is_active = true
        AND created_at >= ${fromISO} AND created_at <= ${toISO}`;

    const ratings = await sql`
      SELECT worker_id, rating, comment, created_at FROM staff_ratings
      WHERE salon_id = ${user.salon_id} AND worker_id IS NOT NULL
        AND created_at >= ${fromISO} AND created_at <= ${toISO}`;

    const ledger = workerList.map((member: any) => {
      const memberVisits  = visits.filter((v: any) => v.worker_id === member.id);
      const memberRatings = ratings.filter((r: any) => r.worker_id === member.id);
      const totalRevenue  = memberVisits.reduce((s: number, v: any) => s + Number(v.total_amount || 0), 0);
      const avgRating     = memberRatings.length > 0
        ? memberRatings.reduce((s: number, r: any) => s + r.rating, 0) / memberRatings.length
        : null;
      return {
        id: member.id, name: member.name, phone: member.phone, job_title: member.job_title,
        services_count: memberVisits.length,
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
