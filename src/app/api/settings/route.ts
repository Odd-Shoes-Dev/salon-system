import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

// GET /api/settings — return current salon data
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('salons')
      .select('id, name, phone, email, address, city, slogan, logo_url, theme_primary_color, theme_secondary_color, loyalty_points_per_ugx, loyalty_threshold, referral_points_reward')
      .eq('id', user.salon_id)
      .single();

    if (error) return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
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
    const allowed = ['name', 'phone', 'email', 'address', 'city', 'slogan', 'logo_url', 'theme_primary_color', 'theme_secondary_color', 'loyalty_points_per_ugx', 'loyalty_threshold', 'referral_points_reward'];
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in body) patch[key] = body[key];
    }

    if (!patch.name) return NextResponse.json({ error: 'Salon name is required' }, { status: 400 });

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('salons')
      .update(patch)
      .eq('id', user.salon_id)
      .select('id, name, phone, email, address, city, slogan, logo_url, theme_primary_color, theme_secondary_color')
      .single();

    if (error) {
      console.error('Settings PUT error:', error);
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
