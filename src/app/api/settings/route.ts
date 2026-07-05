import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/settings — return current salon data
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [data] = await sql`
      SELECT id, name, phone, email, address, city, slogan, logo_url,
             theme_primary_color, theme_secondary_color, loyalty_points_per_ugx,
             loyalty_threshold, referral_points_reward, birthday_discount_percent,
             birthday_sms_template, referral_sms_enabled, birthday_sms_enabled,
             require_confirm_sensitive, require_confirm_general
      FROM salons WHERE id = ${user.salon_id}
    `;
    if (!data) return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/settings — update salon data (owner/admin only)
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Only owners and admins can update settings' }, { status: 403 });
    }

    const body = await request.json();
    const allowed = ['name', 'phone', 'email', 'address', 'city', 'slogan', 'logo_url', 'theme_primary_color', 'theme_secondary_color', 'loyalty_points_per_ugx', 'loyalty_threshold', 'referral_points_reward', 'birthday_discount_percent', 'birthday_sms_template', 'referral_sms_enabled', 'birthday_sms_enabled', 'require_confirm_sensitive', 'require_confirm_general'];
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in body) patch[key] = body[key];
    }

    if (!patch.name) return NextResponse.json({ error: 'Salon name is required' }, { status: 400 });

    const [data] = await sql`
      UPDATE salons SET
        name                      = ${patch.name as string},
        phone                     = ${patch.phone as string ?? ''},
        email                     = ${patch.email as string ?? null},
        address                   = ${patch.address as string ?? null},
        city                      = ${patch.city as string ?? null},
        slogan                    = ${patch.slogan as string ?? null},
        logo_url                  = ${patch.logo_url as string ?? null},
        theme_primary_color       = ${patch.theme_primary_color as string ?? '#2563EB'},
        theme_secondary_color     = ${patch.theme_secondary_color as string ?? '#F59E0B'},
        loyalty_points_per_ugx    = ${patch.loyalty_points_per_ugx as number ?? 1},
        loyalty_threshold         = ${patch.loyalty_threshold as number ?? 1000},
        referral_points_reward    = ${patch.referral_points_reward as number ?? 50},
        birthday_discount_percent = ${patch.birthday_discount_percent as number ?? 0},
        birthday_sms_template     = ${patch.birthday_sms_template as string ?? null},
        referral_sms_enabled      = ${patch.referral_sms_enabled as boolean ?? true},
        birthday_sms_enabled      = ${patch.birthday_sms_enabled as boolean ?? true},
        require_confirm_sensitive = ${patch.require_confirm_sensitive as boolean ?? false},
        require_confirm_general   = ${patch.require_confirm_general as boolean ?? false},
        updated_at                = NOW()
      WHERE id = ${user.salon_id}
      RETURNING id, name, phone, email, address, city, slogan, logo_url,
                theme_primary_color, theme_secondary_color,
                require_confirm_sensitive, require_confirm_general
    `;

    if (!data) {
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
