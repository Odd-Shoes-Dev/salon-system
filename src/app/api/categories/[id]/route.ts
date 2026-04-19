import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

// GET /api/categories/[id] - Get single category
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('service_categories')
      .select('*')
      .eq('id', id)
      .eq('salon_id', user.salon_id)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Category GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/categories/[id] - Update category
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'owner' && user.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description, color, icon, sort_order, is_active } = body;

    const supabase = await createClient();

    // Check the category exists and belongs to this salon
    const { data: existing } = await supabase
      .from('service_categories')
      .select('id, name')
      .eq('id', id)
      .eq('salon_id', user.salon_id)
      .is('deleted_at', null)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    // If renaming, check duplicate
    if (name && name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const { data: duplicate } = await supabase
        .from('service_categories')
        .select('id')
        .eq('salon_id', user.salon_id)
        .ilike('name', name.trim())
        .is('deleted_at', null)
        .neq('id', id)
        .single();

      if (duplicate) {
        return NextResponse.json(
          { error: 'A category with this name already exists' },
          { status: 409 }
        );
      }
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (color !== undefined) updateData.color = color;
    if (icon !== undefined) updateData.icon = icon || null;
    if (sort_order !== undefined) updateData.sort_order = sort_order;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await supabase
      .from('service_categories')
      .update(updateData)
      .eq('id', id)
      .eq('salon_id', user.salon_id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A category with this name already exists' },
          { status: 409 }
        );
      }
      console.error('Error updating category:', error);
      return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Category PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/categories/[id] - Soft delete category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'owner' && user.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = await createClient();

    // Check the category exists
    const { data: existing } = await supabase
      .from('service_categories')
      .select('id, name')
      .eq('id', id)
      .eq('salon_id', user.salon_id)
      .is('deleted_at', null)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    // Check if any active services use this category
    const { data: services } = await supabase
      .from('services')
      .select('id')
      .eq('salon_id', user.salon_id)
      .eq('category', existing.name)
      .eq('is_active', true)
      .limit(1);

    if (services && services.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete a category that has active services. Deactivate or move those services first.' },
        { status: 409 }
      );
    }

    // Soft delete
    const { error } = await supabase
      .from('service_categories')
      .update({
        is_active: false,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('salon_id', user.salon_id);

    if (error) {
      console.error('Error deleting category:', error);
      return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Category DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
