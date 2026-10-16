import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/expense-category-groups
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rows = await sql`
      SELECT id, name, sort_order
      FROM expense_category_groups
      WHERE salon_id = ${user.salon_id}
        AND deleted_at IS NULL
      ORDER BY sort_order ASC, name ASC
    `;

    return NextResponse.json({ groups: rows });
  } catch (error) {
    console.error('GET expense-category-groups error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/expense-category-groups
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const duplicate = await sql`
      SELECT id FROM expense_category_groups
      WHERE salon_id = ${user.salon_id}
        AND deleted_at IS NULL
        AND LOWER(name) = LOWER(${name.trim()})
    `;
    if (duplicate.length > 0) {
      return NextResponse.json({ error: 'Group already exists' }, { status: 409 });
    }

    const [maxRow] = await sql`
      SELECT COALESCE(MAX(sort_order), -1) AS max_order
      FROM expense_category_groups
      WHERE salon_id = ${user.salon_id}
    `;
    const nextOrder = Number(maxRow.max_order) + 1;

    const [row] = await sql`
      INSERT INTO expense_category_groups (salon_id, name, sort_order)
      VALUES (${user.salon_id}, ${name.trim()}, ${nextOrder})
      RETURNING id, name, sort_order
    `;

    return NextResponse.json({ group: row }, { status: 201 });
  } catch (error) {
    console.error('POST expense-category-groups error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
