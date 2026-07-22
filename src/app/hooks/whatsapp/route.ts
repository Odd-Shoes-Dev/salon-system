import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { headers } from 'next/headers';

async function getSalonByDomain() {
  const h = await headers();
  const customDomain = h.get('x-custom-domain');
  const subdomain    = h.get('x-salon-subdomain');

  if (customDomain) {
    const [salon] = await sql`
      SELECT id, whatsapp_verify_token, whatsapp_phone_number_id
      FROM salons WHERE custom_domain = ${customDomain} AND is_active = true
    `;
    return salon ?? null;
  }

  if (subdomain) {
    const [salon] = await sql`
      SELECT id, whatsapp_verify_token, whatsapp_phone_number_id
      FROM salons WHERE subdomain = ${subdomain} AND is_active = true
    `;
    return salon ?? null;
  }

  return null;
}

// GET — Meta calls this to verify the webhook endpoint
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get('hub.mode');
  const token     = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode !== 'subscribe' || !token || !challenge) {
    return new NextResponse('Bad Request', { status: 400 });
  }

  const salon = await getSalonByDomain();
  if (!salon) return new NextResponse('Salon not found', { status: 404 });

  if (!salon.whatsapp_verify_token || salon.whatsapp_verify_token !== token) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Must return the challenge as plain text — Meta checks this
  return new NextResponse(challenge, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}

// POST — Meta sends incoming messages and status updates here
export async function POST(req: NextRequest) {
  try {
    const salon = await getSalonByDomain();
    if (!salon) return new NextResponse('Salon not found', { status: 404 });

    const body = await req.json();

    // Process each entry in the payload
    for (const entry of body?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value;

        // Incoming messages
        for (const msg of value?.messages ?? []) {
          console.log(`[WhatsApp] Incoming message [salon ${salon.id}] from ${msg.from}:`, msg);
          // Future: auto-reply, log to DB, notify staff
        }

        // Delivery / read status updates
        for (const status of value?.statuses ?? []) {
          console.log(`[WhatsApp] Status update [salon ${salon.id}]:`, status.id, status.status);
        }
      }
    }

    // Always respond 200 quickly — Meta retries if you don't
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ received: true });
  }
}
