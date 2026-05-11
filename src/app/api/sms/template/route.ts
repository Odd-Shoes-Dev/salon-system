import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getDefaultReceiptSmsTemplate } from '@/lib/esms';

const TEMPLATE_NAME = 'receipt_sms';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [data] = await sql`
      SELECT id, template, display_name, trigger_type, updated_at
      FROM message_templates
      WHERE salon_id = ${user.salon_id} AND name = ${TEMPLATE_NAME}`;

    return NextResponse.json({
      template: data?.template || getDefaultReceiptSmsTemplate(),
      exists: Boolean(data),
      metadata: data || null,
    });
  } catch (error) {
    console.error('SMS template GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const template = ((await request.json())?.template || '').trim();
    if (!template) return NextResponse.json({ error: 'Template is required' }, { status: 400 });

    const [data] = await sql`
      INSERT INTO message_templates (salon_id, name, display_name, template, trigger_type, is_active)
      VALUES (${user.salon_id}, ${TEMPLATE_NAME}, 'Receipt SMS Template', ${template}, 'receipt', true)
      ON CONFLICT (salon_id, name) DO UPDATE SET template = EXCLUDED.template, updated_at = NOW()
      RETURNING id, template, updated_at`;

    return NextResponse.json({ success: true, template: data });
  } catch (error) {
    console.error('SMS template PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

