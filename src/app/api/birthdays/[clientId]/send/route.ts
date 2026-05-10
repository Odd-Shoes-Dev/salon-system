import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { sendSms } from '@/lib/esms';

// POST /api/birthdays/[clientId]/send
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { clientId }                       = await params;
    const { message_text, discount_percent } = await request.json();

    if (!message_text?.trim()) {
      return NextResponse.json({ error: 'Message text is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify client belongs to this salon
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, phone')
      .eq('id', clientId)
      .eq('salon_id', user.salon_id)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    if (!client.phone) {
      return NextResponse.json({ error: 'Client has no phone number' }, { status: 400 });
    }

    // Send SMS
    let smsStatus = 'sent';
    try {
      await sendSms({ to: client.phone, text: message_text });
    } catch (smsErr) {
      console.error('Birthday SMS send error:', smsErr);
      smsStatus = 'failed';
    }

    // Log the message
    const year = new Date().getFullYear();
    const { data: logged, error: logError } = await supabase
      .from('birthday_messages')
      .insert({
        salon_id:         user.salon_id,
        client_id:        clientId,
        message_text,
        discount_percent: discount_percent ?? null,
        status:           smsStatus,
        year_sent:        year,
      })
      .select()
      .single();

    if (logError) {
      console.error('Birthday message log error:', logError);
      return NextResponse.json({ error: 'Failed to log message' }, { status: 500 });
    }

    if (smsStatus === 'failed') {
      return NextResponse.json(
        { success: false, status: 'failed', message: logged, error: 'SMS delivery failed but message was logged' },
        { status: 207 }
      );
    }

    return NextResponse.json({ success: true, status: smsStatus, message: logged });
  } catch (error) {
    console.error('Birthday send error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
