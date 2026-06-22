import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const [data] = await sql`
      SELECT * FROM service_categories WHERE id = ${id} AND salon_id = ${user.salon_id} AND is_active = true`;
    if (!data) return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (error) {
    console.error('Category GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'owner' && user.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const { name, is_active } = await request.json();

    const [existing] = await sql`
      SELECT id, name, is_active FROM service_categories WHERE id = ${id} AND salon_id = ${user.salon_id}`;
    if (!existing) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

    if (name && name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const [dup] = await sql`
        SELECT id FROM service_categories
        WHERE salon_id = ${user.salon_id} AND name ILIKE ${name.trim()} AND is_active = true AND id != ${id}`;
      if (dup) return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 });
    }

    try {
      const [data] = await sql`
        UPDATE service_categories SET
          name      = ${name !== undefined ? name.trim() : existing.name},
          is_active = ${is_active !== undefined ? is_active : existing.is_active}
        WHERE id = ${id} AND salon_id = ${user.salon_id}
        RETURNING *`;
      return NextResponse.json(data);
    } catch (err: any) {
      if (err.code === '23505') return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 });
      throw err;
    }
  } catch (error) {
    console.error('Category PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

