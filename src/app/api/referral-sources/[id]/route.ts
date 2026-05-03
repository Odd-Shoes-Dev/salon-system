import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

// PUT /api/referral-sources/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const patch: Record<string, unknown> = {};
    if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim();
    if (typeof body.is_active === 'boolean') patch.is_active = body.is_active;
    if (typeof body.sort_order === 'number') patch.sort_order = body.sort_order;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('referral_sources')
      .update(patch)
      .eq('id', id)
      .eq('salon_id', user.salon_id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: 'Failed to update source' }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/referral-sources/[id]  (soft-delete via is_active = false)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = await createClient();
    const { error } = await supabase
      .from('referral_sources')
      .update({ is_active: false })
      .eq('id', id)
      .eq('salon_id', user.salon_id);

    if (error) return NextResponse.json({ error: 'Failed to delete source' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
