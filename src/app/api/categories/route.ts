import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

// GET /api/categories - List categories for the salon
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const showAll = searchParams.get('showAll') === 'true';
    const search = searchParams.get('search');

    const supabase = await createClient();

    let query = supabase
      .from('service_categories')
      .select('*')
      .eq('salon_id', user.salon_id)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (!showAll) {
      query = query.eq('is_active', true);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data: categories, error } = await query;

    if (error) {
      console.error('Error fetching categories:', error);
      return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
    }

    // Attach service counts
    const { data: serviceCounts } = await supabase
      .from('services')
      .select('category')
      .eq('salon_id', user.salon_id)
      .eq('is_active', true);

    const countMap: Record<string, number> = {};
    (serviceCounts || []).forEach((s) => {
      if (s.category) countMap[s.category] = (countMap[s.category] || 0) + 1;
    });

    const result = (categories || []).map((cat) => ({
      ...cat,
      service_count: countMap[cat.name] || 0,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Categories GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/categories - Create new category
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'owner' && user.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, color, icon, sort_order } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Check for duplicate name in this salon
    const { data: existing } = await supabase
      .from('service_categories')
      .select('id, deleted_at')
      .eq('salon_id', user.salon_id)
      .ilike('name', name.trim())
      .is('deleted_at', null)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'A category with this name already exists' },
        { status: 409 }
      );
    }

    // Get max sort_order if not provided
    let finalSortOrder = sort_order;
    if (finalSortOrder === undefined || finalSortOrder === null) {
      const { data: maxRow } = await supabase
        .from('service_categories')
        .select('sort_order')
        .eq('salon_id', user.salon_id)
        .is('deleted_at', null)
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();

      finalSortOrder = maxRow ? maxRow.sort_order + 1 : 0;
    }

    const { data, error } = await supabase
      .from('service_categories')
      .insert({
        salon_id: user.salon_id,
        name: name.trim(),
        description: description?.trim() || null,
        color: color || '#E31C23',
        icon: icon || null,
        sort_order: finalSortOrder,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A category with this name already exists' },
          { status: 409 }
        );
      }
      console.error('Error creating category:', error);
      return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Categories POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
