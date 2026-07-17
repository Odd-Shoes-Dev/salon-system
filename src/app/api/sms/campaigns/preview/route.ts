import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import type { SegmentType } from '../route';

function segmentToDates(type: SegmentType, params?: { last_visit_after?: string; last_visit_before?: string }) {
  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400_000).toISOString();
  switch (type) {
    case 'last_7_days':   return { after: daysAgo(7),  before: null,        neverVisited: false };
    case 'last_30_days':  return { after: daysAgo(30), before: null,        neverVisited: false };
    case 'not_30_60':     return { after: daysAgo(60), before: daysAgo(30), neverVisited: false };
    case 'not_60_plus':   return { after: null,        before: daysAgo(60), neverVisited: false };
    case 'never_visited': return { after: null,        before: null,        neverVisited: true  };
    case 'custom':        return { after: params?.last_visit_after ?? null, before: params?.last_visit_before ?? null, neverVisited: false };
    default:              return { after: null, before: null, neverVisited: false };
  }
}

// GET /api/sms/campaigns/preview
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const segmentType  = (searchParams.get('segment_type') ?? 'last_7_days') as SegmentType;
    const customAfter  = searchParams.get('last_visit_after')  || undefined;
    const customBefore = searchParams.get('last_visit_before') || undefined;

    // by_service: find clients who had a specific service done
    if (segmentType === 'by_service') {
      const serviceId  = searchParams.get('service_id') || null;
      const dateAfter  = searchParams.get('date_after')  || null;
      const dateBefore = searchParams.get('date_before') || null;

      if (!serviceId) return NextResponse.json({ clients: [], total: 0 });

      const clients = await sql`
        SELECT c.id, c.name, c.phone, c.last_visit,
               MAX(v.recorded_at) AS last_service_date
        FROM clients c
        JOIN visits v ON v.client_id = c.id
          AND v.salon_id = c.salon_id
          AND v.deleted_at IS NULL
          AND v.is_active = true
        JOIN visit_services vs ON vs.visit_id = v.id
          AND vs.service_id = ${serviceId}::uuid
        WHERE c.salon_id = ${user.salon_id}
          AND c.is_active = true
          AND c.deleted_at IS NULL
          AND c.phone IS NOT NULL AND c.phone <> ''
          AND (${dateAfter}::timestamptz  IS NULL OR v.recorded_at >= ${dateAfter}::timestamptz)
          AND (${dateBefore}::timestamptz IS NULL OR v.recorded_at <= ${dateBefore}::timestamptz)
        GROUP BY c.id, c.name, c.phone, c.last_visit
        ORDER BY last_service_date DESC
        LIMIT 200
      `;

      return NextResponse.json({ clients, total: clients.length });
    }

    // custom_list: clients are picked in the UI — nothing to resolve server-side
    if (segmentType === 'custom_list') {
      return NextResponse.json({ clients: [], total: 0 });
    }

    // Standard date-based segments
    const { after, before, neverVisited } = segmentToDates(segmentType, { last_visit_after: customAfter, last_visit_before: customBefore });

    const clients = await sql`
      SELECT id, name, phone, last_visit FROM clients
      WHERE salon_id = ${user.salon_id}
        AND is_active = true
        AND deleted_at IS NULL
        AND phone IS NOT NULL AND phone <> ''
        AND (${after}::timestamptz  IS NULL OR last_visit >= ${after}::timestamptz)
        AND (${before}::timestamptz IS NULL OR last_visit <  ${before}::timestamptz)
        AND (${neverVisited} = false OR last_visit IS NULL)
      ORDER BY last_visit DESC NULLS LAST, name
      LIMIT 200
    `;

    return NextResponse.json({ clients, total: clients.length });
  } catch (err: any) {
    console.error('GET /api/sms/campaigns/preview error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
