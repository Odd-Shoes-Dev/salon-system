import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

// ── GET — list recent movements (all or per item) ─────────────
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('item_id');
    const limit  = Number(searchParams.get('limit') || 50);

    const supabase = await createClient();
    let query = supabase
      .from('stock_movements')
      .select('*, item:stock_items(name, unit), staff:staff!created_by(name)')
      .eq('salon_id', user.salon_id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (itemId) query = query.eq('item_id', itemId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('GET /api/inventory/movements error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST — record a qty adjustment ───────────────────────────
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { item_id, qty_change, reason, notes } = await request.json();
    if (!item_id) return NextResponse.json({ error: 'item_id is required' }, { status: 400 });
    if (qty_change === undefined || qty_change === null || qty_change === 0) {
      return NextResponse.json({ error: 'qty_change must be non-zero' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get current qty (verify ownership)
    const { data: item, error: fetchErr } = await supabase
      .from('stock_items')
      .select('current_qty')
      .eq('id', item_id)
      .eq('salon_id', user.salon_id)
      .single();

    if (fetchErr || !item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const newQty = Number(item.current_qty) + Number(qty_change);
    if (newQty < 0) return NextResponse.json({ error: 'Quantity cannot go below zero' }, { status: 400 });

    // Update item qty
    await supabase
      .from('stock_items')
      .update({ current_qty: newQty, updated_at: new Date().toISOString() })
      .eq('id', item_id);

    // Log movement
    const { data: movement, error: moveErr } = await supabase
      .from('stock_movements')
      .insert({
        salon_id:   user.salon_id,
        item_id,
        qty_change: Number(qty_change),
        qty_after:  newQty,
        reason:     reason || 'adjustment',
        notes:      notes?.trim() || null,
        created_by: user.id,
      })
      .select('*, item:stock_items(name, unit), staff:staff!created_by(name)')
      .single();

    if (moveErr) throw moveErr;
    return NextResponse.json({ movement, new_qty: newQty }, { status: 201 });
  } catch (err) {
    console.error('POST /api/inventory/movements error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
