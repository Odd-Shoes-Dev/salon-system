import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('stock_groups')
      .select('*, stock_items(count)')
      .eq('salon_id', user.salon_id)
      .order('sort_order')
      .order('name');

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('GET /api/inventory/groups error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { name, description, color, sort_order } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('stock_groups')
      .insert({
        salon_id:    user.salon_id,
        name:        name.trim(),
        description: description?.trim() || null,
        color:       color || '#6366f1',
        sort_order:  sort_order ?? 0,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'A group with this name already exists' }, { status: 409 });
      throw error;
    }
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('POST /api/inventory/groups error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
