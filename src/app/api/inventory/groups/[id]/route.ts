import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const { name, description, color, sort_order, is_active } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('stock_groups')
      .update({ name: name.trim(), description: description?.trim() || null, color, sort_order, is_active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('salon_id', user.salon_id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'A group with this name already exists' }, { status: 409 });
      throw error;
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error('PUT /api/inventory/groups/[id] error:', err);
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
    // Set group_id to NULL on items (don't delete items)
    await supabase.from('stock_items').update({ group_id: null }).eq('group_id', id).eq('salon_id', user.salon_id);
    await supabase.from('stock_groups').delete().eq('id', id).eq('salon_id', user.salon_id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/inventory/groups/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
