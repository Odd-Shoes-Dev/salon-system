import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [data] = await sql`
      SELECT
        whatsapp_phone_number,
        whatsapp_phone_number_id,
        whatsapp_verify_token,
        whatsapp_status,
        custom_domain,
        subdomain,
        (whatsapp_access_token IS NOT NULL AND whatsapp_access_token != '') AS access_token_set
      FROM salons WHERE id = ${user.salon_id}
    `;

    return NextResponse.json(data ?? {});
  } catch (err) {
    console.error('GET /api/settings/whatsapp error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { phone_number, phone_number_id, access_token, verify_token } = await req.json();

    if (access_token?.trim()) {
      await sql`
        UPDATE salons SET
          whatsapp_phone_number    = ${phone_number?.trim() || null},
          whatsapp_phone_number_id = ${phone_number_id?.trim() || null},
          whatsapp_access_token    = ${access_token.trim()},
          whatsapp_verify_token    = ${verify_token?.trim() || null},
          whatsapp_status          = 'configured',
          updated_at               = NOW()
        WHERE id = ${user.salon_id}
      `;
    } else {
      await sql`
        UPDATE salons SET
          whatsapp_phone_number    = ${phone_number?.trim() || null},
          whatsapp_phone_number_id = ${phone_number_id?.trim() || null},
          whatsapp_verify_token    = ${verify_token?.trim() || null},
          updated_at               = NOW()
        WHERE id = ${user.salon_id}
      `;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('PUT /api/settings/whatsapp error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
