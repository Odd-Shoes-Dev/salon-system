import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { getDefaultReceiptSmsTemplate } from '@/lib/esms';

const TEMPLATE_NAME = 'receipt_sms';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('message_templates')
      .select('id, template, display_name, trigger_type, updated_at')
      .eq('salon_id', user.salon_id)
      .eq('name', TEMPLATE_NAME)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Failed to load template' }, { status: 500 });
    }

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
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['owner', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const template = (body?.template || '').trim();

    if (!template) {
      return NextResponse.json({ error: 'Template is required' }, { status: 400 });
    }

    const supabase = await createClient();

    const payload = {
      salon_id: user.salon_id,
      name: TEMPLATE_NAME,
      display_name: 'Receipt SMS Template',
      template,
      trigger_type: 'receipt',
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('message_templates')
      .upsert(payload, { onConflict: 'salon_id,name' })
      .select('id, template, updated_at')
      .single();

    if (error) {
      console.error('SMS template PUT error:', error);
      return NextResponse.json({ error: 'Failed to save template' }, { status: 500 });
    }

    return NextResponse.json({ success: true, template: data });
  } catch (error) {
    console.error('SMS template PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
