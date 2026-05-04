import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

// GET /api/addons — list active add-ons for this salon
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('service_addons')
      .select('id, name, price, description, is_active, sort_order')
      .eq('salon_id', user.salon_id)
      .order('sort_order')
      .order('name');

    if (error) {
      console.error('Addons GET error:', error);
      return NextResponse.json({ error: 'Failed to fetch add-ons' }, { status: 500 });
    }
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Addons GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/addons — create a new add-on
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { name, price, description, sort_order } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    if (price === undefined || price < 0) return NextResponse.json({ error: 'Price must be 0 or more' }, { status: 400 });

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('service_addons')
      .insert({
        salon_id:    user.salon_id,
        name:        name.trim(),
        price:       Math.round(Number(price)),
        description: description?.trim() || null,
        sort_order:  sort_order ?? 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Addon POST error:', error);
      return NextResponse.json({ error: 'Failed to create add-on' }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Addon POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
