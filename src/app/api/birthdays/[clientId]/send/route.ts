import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { smsProvider } from '@/lib/sms';

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

    if (!message_text?.trim()) return NextResponse.json({ error: 'Message text is required' }, { status: 400 });

    const [client] = await sql`
      SELECT id, name, phone FROM clients WHERE id = ${clientId} AND salon_id = ${user.salon_id}`;
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    if (!client.phone) return NextResponse.json({ error: 'Client has no phone number' }, { status: 400 });

    let smsStatus = 'sent';
    try {
      await smsProvider.sendMessage(client.phone, message_text);
    } catch (smsErr) {
      console.error('Birthday SMS send error:', smsErr);
      smsStatus = 'failed';
    }

    const year = new Date().getFullYear();
    const [logged] = await sql`
      INSERT INTO birthday_messages (salon_id, client_id, message_text, discount_percent, status, year_sent)
      VALUES (${user.salon_id}, ${clientId}, ${message_text}, ${discount_percent ?? null}, ${smsStatus}, ${year})
      RETURNING *`;

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
