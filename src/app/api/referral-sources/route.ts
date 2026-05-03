import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

// GET /api/referral-sources
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('referral_sources')
      .select('*')
      .eq('salon_id', user.salon_id)
      .eq('is_active', true)
      .order('sort_order')
      .order('name');

    if (error) return NextResponse.json({ error: 'Failed to load sources' }, { status: 500 });
    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/referral-sources
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { name } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from('referral_sources')
      .select('id, is_active')
      .eq('salon_id', user.salon_id)
      .eq('name', name.trim())
      .single();

    if (existing) {
      if (!existing.is_active) {
        const { data: restored, error: re } = await supabase
          .from('referral_sources')
          .update({ is_active: true })
          .eq('id', existing.id)
          .select()
          .single();
        if (re) return NextResponse.json({ error: 'Failed to restore source' }, { status: 500 });
        return NextResponse.json(restored, { status: 200 });
      }
      return NextResponse.json({ error: 'Source already exists' }, { status: 409 });
    }

    const { data: maxOrder } = await supabase
      .from('referral_sources')
      .select('sort_order')
      .eq('salon_id', user.salon_id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const { data, error } = await supabase
      .from('referral_sources')
      .insert({ salon_id: user.salon_id, name: name.trim(), sort_order: (maxOrder?.sort_order ?? 0) + 1 })
      .select()
      .single();

    if (error) return NextResponse.json({ error: 'Failed to create source' }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
