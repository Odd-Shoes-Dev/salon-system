import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

// GET /api/workers/ledger?from_date=X&to_date=Y
// Returns performance stats for all staff members in a given period
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const fromDate = searchParams.get('from_date');
    const toDate = searchParams.get('to_date');
    const period = searchParams.get('period') || 'month';

    const supabase = await createClient();

    // Build date range
    let fromISO: string;
    let toISO: string;

    if (fromDate && toDate) {
      fromISO = `${fromDate}T00:00:00.000Z`;
      toISO = `${toDate}T23:59:59.999Z`;
    } else {
      const now = new Date();
      toISO = now.toISOString();
      if (period === 'today') {
        fromISO = new Date(now.toISOString().split('T')[0] + 'T00:00:00.000Z').toISOString();
      } else if (period === 'week') {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        fromISO = weekStart.toISOString();
      } else {
        // month
        fromISO = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      }
    }

    // Get all active workers for this salon
    const { data: workerList, error: workersError } = await supabase
      .from('workers')
      .select('id, name, phone, job_title')
      .eq('salon_id', user.salon_id)
      .eq('is_active', true)
      .order('name');

    if (workersError) {
      return NextResponse.json({ error: 'Failed to fetch workers' }, { status: 500 });
    }

    // Get visits served by each worker in the period
    const { data: visits, error: visitsError } = await supabase
      .from('visits')
      .select('id, worker_id, total_amount, created_at')
      .eq('salon_id', user.salon_id)
      .eq('is_active', true)
      .gte('created_at', fromISO)
      .lte('created_at', toISO);

    if (visitsError) {
      return NextResponse.json({ error: 'Failed to fetch visits' }, { status: 500 });
    }

    // Get ratings in the period
    const { data: ratings, error: ratingsError } = await supabase
      .from('staff_ratings')
      .select('worker_id, rating, comment, created_at')
      .eq('salon_id', user.salon_id)
      .not('worker_id', 'is', null)
      .gte('created_at', fromISO)
      .lte('created_at', toISO);

    if (ratingsError) {
      return NextResponse.json({ error: 'Failed to fetch ratings' }, { status: 500 });
    }

    // Build ledger per worker
    const ledger = (workerList || []).map((member: any) => {
      const memberVisits = (visits || []).filter((v: any) => v.worker_id === member.id);
      const memberRatings = (ratings || []).filter((r: any) => r.worker_id === member.id);

      const totalRevenue = memberVisits.reduce((sum: number, v: any) => sum + Number(v.total_amount || 0), 0);
      const servicesCount = memberVisits.length;
      const avgRating = memberRatings.length > 0
        ? memberRatings.reduce((sum: number, r: any) => sum + r.rating, 0) / memberRatings.length
        : null;

      return {
        id: member.id,
        name: member.name,
        phone: member.phone,
        job_title: member.job_title,
        services_count: servicesCount,
        total_revenue: totalRevenue,
        ratings_count: memberRatings.length,
        avg_rating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        recent_ratings: memberRatings.slice(0, 5),
      };
    });

    return NextResponse.json({
      ledger,
      period: { from: fromISO, to: toISO },
    });
  } catch (error) {
    console.error('Workers ledger error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
