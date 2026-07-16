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

// GET /api/sms/campaigns/preview?segment_type=...&last_visit_after=...&last_visit_before=...
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const segmentType = (searchParams.get('segment_type') ?? 'last_7_days') as SegmentType;
    const customAfter  = searchParams.get('last_visit_after')  || undefined;
    const customBefore = searchParams.get('last_visit_before') || undefined;

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
