import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const DEFAULTS = [
  'Rent', 'Salaries', 'Supplies', 'Utilities', 'Equipment',
  'Marketing', 'Transport', 'Maintenance', 'Other',
];

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS expense_categories (
      id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
      salon_id   UUID        NOT NULL,
      name       TEXT        NOT NULL,
      sort_order INT         DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    )
  `;
}

async function seedDefaults(salonId: string) {
  const existing = await sql`
    SELECT COUNT(*) AS c FROM expense_categories WHERE salon_id = ${salonId}
  `;
  if (Number(existing[0].c) > 0) return;

  // Combine preset defaults with any categories already used in expenses
  const usedRows = await sql`
    SELECT DISTINCT category FROM expenses
    WHERE salon_id = ${salonId} AND deleted_at IS NULL AND category IS NOT NULL
  `;
  const usedNames = (usedRows as any[]).map(r => r.category as string);
  const allNames  = [...new Set([...DEFAULTS, ...usedNames])];

  for (let i = 0; i < allNames.length; i++) {
    await sql`
      INSERT INTO expense_categories (salon_id, name, sort_order)
      VALUES (${salonId}, ${allNames[i]}, ${i})
    `;
  }
}

// GET /api/expense-categories
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureTable();
    await seedDefaults(user.salon_id);

    const rows = await sql`
      SELECT id, name, sort_order
      FROM expense_categories
      WHERE salon_id = ${user.salon_id}
        AND deleted_at IS NULL
      ORDER BY sort_order ASC, name ASC
    `;

    return NextResponse.json({ categories: rows });
  } catch (error) {
    console.error('GET expense-categories error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/expense-categories
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    await ensureTable();

    const duplicate = await sql`
      SELECT id FROM expense_categories
      WHERE salon_id = ${user.salon_id}
        AND deleted_at IS NULL
        AND LOWER(name) = LOWER(${name.trim()})
    `;
    if (duplicate.length > 0) {
      return NextResponse.json({ error: 'Category already exists' }, { status: 409 });
    }

    const [maxRow] = await sql`
      SELECT COALESCE(MAX(sort_order), -1) AS max_order
      FROM expense_categories
      WHERE salon_id = ${user.salon_id}
    `;
    const nextOrder = Number(maxRow.max_order) + 1;

    const [row] = await sql`
      INSERT INTO expense_categories (salon_id, name, sort_order)
      VALUES (${user.salon_id}, ${name.trim()}, ${nextOrder})
      RETURNING id, name, sort_order
    `;

    return NextResponse.json({ category: row }, { status: 201 });
  } catch (error) {
    console.error('POST expense-categories error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
