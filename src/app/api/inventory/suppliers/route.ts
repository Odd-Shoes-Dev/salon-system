import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await sql`
      SELECT
        sup.*,
        COUNT(si.id)::int AS item_count
      FROM suppliers sup
      LEFT JOIN stock_items si
        ON  si.supplier_id = sup.id
        AND si.is_active   = true
        AND si.deleted_at  IS NULL
      WHERE sup.salon_id  = ${user.salon_id}
        AND sup.deleted_at IS NULL
      GROUP BY sup.id
      ORDER BY sup.name`;

    return NextResponse.json(data);
  } catch (err) {
    console.error('GET /api/inventory/suppliers error:', err);
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

    const { name, contact_person, phone, email, address, notes } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    try {
      const [data] = await sql`
        INSERT INTO suppliers (salon_id, name, contact_person, phone, email, address, notes)
        VALUES (
          ${user.salon_id}, ${name.trim()},
          ${contact_person?.trim() || null}, ${phone?.trim() || null},
          ${email?.trim() || null}, ${address?.trim() || null}, ${notes?.trim() || null}
        )
        RETURNING *`;
      return NextResponse.json({ ...data, item_count: 0 }, { status: 201 });
    } catch (err: any) {
      if (err.code === '23505') return NextResponse.json({ error: 'A supplier with this name already exists' }, { status: 409 });
      throw err;
    }
  } catch (err) {
    console.error('POST /api/inventory/suppliers error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
