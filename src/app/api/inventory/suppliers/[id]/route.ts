import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const [data] = await sql`
      SELECT sup.*, COUNT(si.id)::int AS item_count
      FROM suppliers sup
      LEFT JOIN stock_items si ON si.supplier_id = sup.id AND si.is_active = true AND si.deleted_at IS NULL
      WHERE sup.id = ${id} AND sup.salon_id = ${user.salon_id} AND sup.deleted_at IS NULL
      GROUP BY sup.id`;

    if (!data) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    console.error('GET /api/inventory/suppliers/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const { name, contact_person, phone, email, address, notes, is_active } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    try {
      const [data] = await sql`
        UPDATE suppliers SET
          name           = ${name.trim()},
          contact_person = ${contact_person?.trim() || null},
          phone          = ${phone?.trim() || null},
          email          = ${email?.trim() || null},
          address        = ${address?.trim() || null},
          notes          = ${notes?.trim() || null},
          is_active      = COALESCE(${is_active ?? null}, is_active),
          updated_at     = NOW()
        WHERE id = ${id} AND salon_id = ${user.salon_id} AND deleted_at IS NULL
        RETURNING *`;

      if (!data) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
      return NextResponse.json(data);
    } catch (err: any) {
      if (err.code === '23505') return NextResponse.json({ error: 'A supplier with this name already exists' }, { status: 409 });
      throw err;
    }
  } catch (err) {
    console.error('PUT /api/inventory/suppliers/[id] error:', err);
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

    // Block if active items are still linked to this supplier
    const [itemCheck] = await sql`
      SELECT COUNT(*)::int AS count FROM stock_items
      WHERE supplier_id = ${id} AND salon_id = ${user.salon_id}
        AND is_active = true AND deleted_at IS NULL`;

    if (itemCheck.count > 0) {
      return NextResponse.json(
        { error: `Cannot delete — ${itemCheck.count} item${itemCheck.count > 1 ? 's are' : ' is'} linked to this supplier. Deactivate it instead, or reassign the items first.` },
        { status: 400 }
      );
    }

    await sql`
      UPDATE suppliers SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = ${id} AND salon_id = ${user.salon_id}`;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/inventory/suppliers/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
