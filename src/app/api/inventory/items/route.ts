import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const groupId    = searchParams.get('group_id');
    const lowStock   = searchParams.get('low_stock') === 'true';

    const supabase = await createClient();
    let query = supabase
      .from('stock_items')
      .select('*, group:stock_groups(id, name, color)')
      .eq('salon_id', user.salon_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name');

    if (groupId) query = query.eq('group_id', groupId);

    const { data, error } = await query;
    if (error) throw error;

    let items = data || [];
    if (lowStock) items = items.filter(i => Number(i.current_qty) <= Number(i.reorder_level));

    const totalValue   = items.reduce((s, i) => s + Number(i.current_qty) * Number(i.cost_per_unit), 0);
    const lowStockCount = (data || []).filter(i => Number(i.current_qty) <= Number(i.reorder_level) && Number(i.reorder_level) > 0).length;

    return NextResponse.json({ items, summary: { totalValue, lowStockCount, totalItems: (data || []).length } });
  } catch (err) {
    console.error('GET /api/inventory/items error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, unit, group_id, current_qty, reorder_level, cost_per_unit, supplier } = body;
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('stock_items')
      .insert({
        salon_id:      user.salon_id,
        group_id:      group_id || null,
        name:          name.trim(),
        description:   description?.trim() || null,
        unit:          unit || 'pcs',
        current_qty:   Number(current_qty) || 0,
        reorder_level: Number(reorder_level) || 0,
        cost_per_unit: Number(cost_per_unit) || 0,
        supplier:      supplier?.trim() || null,
      })
      .select('*, group:stock_groups(id, name, color)')
      .single();

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'An item with this name already exists' }, { status: 409 });
      throw error;
    }

    // Log opening movement if qty > 0
    if (Number(current_qty) > 0) {
      await supabase.from('stock_movements').insert({
        salon_id:   user.salon_id,
        item_id:    data.id,
        qty_change: Number(current_qty),
        qty_after:  Number(current_qty),
        reason:     'purchase',
        notes:      'Opening stock',
        created_by: user.id,
      });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('POST /api/inventory/items error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
