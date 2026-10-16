import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// PUT /api/expense-categories/[id]  — rename
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const { name, group_id } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const duplicate = await sql`
      SELECT id FROM expense_categories
      WHERE salon_id = ${user.salon_id}
        AND deleted_at IS NULL
        AND LOWER(name) = LOWER(${name.trim()})
        AND id != ${id}::uuid
    `;
    if (duplicate.length > 0) {
      return NextResponse.json({ error: 'Another category with that name already exists' }, { status: 409 });
    }

    const [row] = await sql`
      UPDATE expense_categories
      SET name = ${name.trim()}, group_id = ${group_id || null}::uuid
      WHERE id = ${id}::uuid
        AND salon_id = ${user.salon_id}
        AND deleted_at IS NULL
      RETURNING id, name, sort_order, group_id
    `;

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ category: row });
  } catch (error) {
    console.error('PUT expense-category error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/expense-categories/[id]  — soft-delete
export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const [row] = await sql`
      UPDATE expense_categories
      SET deleted_at = NOW()
      WHERE id = ${id}::uuid
        AND salon_id = ${user.salon_id}
        AND deleted_at IS NULL
      RETURNING id
    `;

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE expense-category error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
