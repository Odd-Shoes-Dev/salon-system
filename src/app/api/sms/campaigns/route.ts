import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { smsProvider } from '@/lib/sms';

export type SegmentType = 'last_7_days' | 'last_30_days' | 'not_30_60' | 'not_60_plus' | 'never_visited' | 'custom';

function segmentToDates(type: SegmentType, params?: { last_visit_after?: string; last_visit_before?: string }) {
  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400_000).toISOString();
  switch (type) {
    case 'last_7_days':    return { after: daysAgo(7),  before: null,         neverVisited: false };
    case 'last_30_days':   return { after: daysAgo(30), before: null,         neverVisited: false };
    case 'not_30_60':      return { after: daysAgo(60), before: daysAgo(30),  neverVisited: false };
    case 'not_60_plus':    return { after: null,         before: daysAgo(60),  neverVisited: false };
    case 'never_visited':  return { after: null,         before: null,         neverVisited: true  };
    case 'custom':         return { after: params?.last_visit_after ?? null, before: params?.last_visit_before ?? null, neverVisited: false };
    default:               return { after: null, before: null, neverVisited: false };
  }
}

function renderMessage(template: string, clientName: string, salonName: string): string {
  return template
    .replaceAll('{clientName}', clientName)
    .replaceAll('{salonName}', salonName);
}

// GET /api/sms/campaigns — list campaigns for the salon
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const limit  = Math.min(50, Number(searchParams.get('limit') ?? 20));
    const offset = Number(searchParams.get('offset') ?? 0);

    const campaigns = await sql`
      SELECT c.*, s.name AS created_by_name
      FROM sms_campaigns c
      LEFT JOIN staff s ON s.id = c.created_by
      WHERE c.salon_id = ${user.salon_id}
      ORDER BY c.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [{ count }] = await sql`
      SELECT COUNT(*) AS count FROM sms_campaigns WHERE salon_id = ${user.salon_id}
    `;

    return NextResponse.json({ campaigns, total: Number(count) });
  } catch (err: any) {
    console.error('GET /api/sms/campaigns error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/sms/campaigns — create and execute a campaign
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, segment_type, segment_params, message_template } = await request.json();

    if (!segment_type) return NextResponse.json({ error: 'segment_type is required' }, { status: 400 });
    if (!message_template?.trim()) return NextResponse.json({ error: 'message_template is required' }, { status: 400 });

    const { after, before, neverVisited } = segmentToDates(segment_type as SegmentType, segment_params);

    // Fetch matching clients (must have a phone number)
    const clients = await sql`
      SELECT id, name, phone FROM clients
      WHERE salon_id = ${user.salon_id}
        AND is_active = true
        AND deleted_at IS NULL
        AND phone IS NOT NULL AND phone <> ''
        AND (${after}::timestamptz  IS NULL OR last_visit >= ${after}::timestamptz)
        AND (${before}::timestamptz IS NULL OR last_visit <  ${before}::timestamptz)
        AND (${neverVisited} = false OR last_visit IS NULL)
      ORDER BY name
    `;

    if (clients.length === 0) {
      return NextResponse.json({ error: 'No clients match this segment' }, { status: 400 });
    }

    // Fetch salon name for template rendering
    const [salon] = await sql`SELECT name FROM salons WHERE id = ${user.salon_id}`;
    const salonName = salon?.name ?? '';

    // Create the campaign record
    const [campaign] = await sql`
      INSERT INTO sms_campaigns
        (salon_id, created_by, name, segment_type, segment_params, message_template, recipient_count, status)
      VALUES
        (${user.salon_id}, ${user.id}, ${name?.trim() || null}, ${segment_type},
         ${segment_params ? JSON.stringify(segment_params) : null},
         ${message_template.trim()}, ${clients.length}, 'sending')
      RETURNING *
    `;

    // Send messages and log each one
    let sentCount = 0;
    let failedCount = 0;

    for (const client of clients) {
      const messageText = renderMessage(message_template.trim(), client.name ?? '', salonName);
      let status = 'failed';
      let providerMessageId: string | null = null;
      let error: string | null = null;

      try {
        const result = await smsProvider.sendMessage(client.phone, messageText);
        providerMessageId = result.id || null;
        status = 'sent';
        sentCount++;
      } catch (err: any) {
        error = err.message || 'Send failed';
        failedCount++;
      }

      await sql`
        INSERT INTO sms_campaign_messages
          (campaign_id, client_id, phone, client_name, message_text, status, provider_message_id, error, sent_at)
        VALUES
          (${campaign.id}, ${client.id}, ${client.phone}, ${client.name ?? null},
           ${messageText}, ${status}, ${providerMessageId}, ${error},
           ${status === 'sent' ? new Date().toISOString() : null})
      `;
    }

    // Mark campaign complete
    const [updated] = await sql`
      UPDATE sms_campaigns
      SET sent_count   = ${sentCount},
          failed_count = ${failedCount},
          status       = 'completed',
          completed_at = NOW()
      WHERE id = ${campaign.id}
      RETURNING *
    `;

    return NextResponse.json(updated, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/sms/campaigns error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
