import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// PUT /api/addons/[id] — update name, price, active state
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body   = await request.json();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if ('name'        in body) patch.name        = body.name?.trim();
    if ('price'       in body) patch.price       = Math.round(Number(body.price));
    if ('description' in body) patch.description = body.description?.trim() || null;
    if ('is_active'   in body) patch.is_active   = body.is_active;
    if ('sort_order'  in body) patch.sort_order  = body.sort_order;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('service_addons')
      .update(patch)
      .eq('id', id)
      .eq('salon_id', user.salon_id)
      .select()
      .single();

    if (error || !data) return NextResponse.json({ error: 'Add-on not found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (error) {
    console.error('Addon PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/addons/[id] — hard delete if never used, else deactivate
export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Only owners and admins can delete add-ons' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = await createClient();

    // Check if the add-on has been used in any visit
    const { count } = await supabase
      .from('visit_addons')
      .select('id', { count: 'exact', head: true })
      .eq('addon_id', id);

    if ((count ?? 0) > 0) {
      // Soft-delete: just deactivate
      const { data, error } = await supabase
        .from('service_addons')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('salon_id', user.salon_id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: 'Failed to deactivate' }, { status: 500 });
      return NextResponse.json({ ...data, _action: 'deactivated' });
    }

    // Hard delete
    const { error } = await supabase
      .from('service_addons')
      .delete()
      .eq('id', id)
      .eq('salon_id', user.salon_id);

    if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Addon DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
