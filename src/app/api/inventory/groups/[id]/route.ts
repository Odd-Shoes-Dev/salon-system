import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const { name, description, color, sort_order, is_active, parent_id } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    // Prevent circular references — a group cannot be its own parent or ancestor
    if (parent_id) {
      if (parent_id === id) {
        return NextResponse.json({ error: 'A group cannot be its own parent' }, { status: 400 });
      }
      const [parent] = await sql`SELECT id FROM stock_groups WHERE id = ${parent_id} AND salon_id = ${user.salon_id}`;
      if (!parent) return NextResponse.json({ error: 'Parent group not found' }, { status: 404 });
    }

    try {
      const [data] = await sql`
        UPDATE stock_groups SET
          name        = ${name.trim()},
          description = ${description?.trim() || null},
          color       = ${color},
          sort_order  = ${sort_order},
          is_active   = ${is_active},
          parent_id   = ${parent_id || null},
          updated_at  = NOW()
        WHERE id = ${id} AND salon_id = ${user.salon_id}
        RETURNING *`;
      if (!data) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
      return NextResponse.json(data);
    } catch (err: any) {
      if (err.code === '23505') return NextResponse.json({ error: 'A group with this name already exists' }, { status: 409 });
      throw err;
    }
  } catch (err) {
    console.error('PUT /api/inventory/groups/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    // Reparent child groups to null before deleting
    await sql`UPDATE stock_groups SET parent_id = NULL WHERE parent_id = ${id} AND salon_id = ${user.salon_id}`;
    await sql`UPDATE stock_items SET group_id = NULL WHERE group_id = ${id} AND salon_id = ${user.salon_id}`;
    await sql`DELETE FROM stock_groups WHERE id = ${id} AND salon_id = ${user.salon_id}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/inventory/groups/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
