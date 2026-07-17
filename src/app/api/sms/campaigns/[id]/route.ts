import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/sms/campaigns/[id] — campaign detail + per-client message log
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const [campaign] = await sql`
      SELECT c.*, s.name AS created_by_name
      FROM sms_campaigns c
      LEFT JOIN staff s ON s.id = c.created_by
      WHERE c.id = ${id} AND c.salon_id = ${user.salon_id}
    `;

    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

    const messages = await sql`
      SELECT * FROM sms_campaign_messages
      WHERE campaign_id = ${id}
      ORDER BY client_name ASC
    `;

    return NextResponse.json({ ...campaign, messages });
  } catch (err: any) {
    console.error('GET /api/sms/campaigns/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
