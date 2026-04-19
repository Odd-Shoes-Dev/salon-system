import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description, unit, group_id, reorder_level, cost_per_unit, supplier, is_active } = body;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('stock_items')
      .update({
        name:          name?.trim(),
        description:   description?.trim() || null,
        unit,
        group_id:      group_id || null,
        reorder_level: Number(reorder_level) || 0,
        cost_per_unit: Number(cost_per_unit) || 0,
        supplier:      supplier?.trim() || null,
        is_active,
        updated_at:    new Date().toISOString(),
      })
      .eq('id', id)
      .eq('salon_id', user.salon_id)
      .select('*, group:stock_groups(id, name, color)')
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error('PUT /api/inventory/items/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = await createClient();
    await supabase
      .from('stock_items')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', id)
      .eq('salon_id', user.salon_id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/inventory/items/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
