import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const groups = await sql`
      SELECT cg.*,
        COUNT(c.id)::int                                          AS coupon_count,
        COUNT(c.id) FILTER (WHERE c.status = 'active')::int       AS active_count,
        COUNT(c.id) FILTER (WHERE c.status = 'used')::int         AS used_count,
        s.name AS created_by_name
      FROM coupon_groups cg
      LEFT JOIN coupons c ON c.group_id = cg.id AND c.salon_id = cg.salon_id
      LEFT JOIN staff s ON s.id = cg.created_by
      WHERE cg.salon_id = ${user.salon_id}
      GROUP BY cg.id, s.name
      ORDER BY cg.created_at DESC`;

    return NextResponse.json(groups);
  } catch (err) {
    console.error('GET /api/coupons/groups error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Only managers and above can create coupon groups' }, { status: 403 });
    }

    const { name, value, note } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
    if (!value || Number(value) <= 0) return NextResponse.json({ error: 'Value must be greater than 0' }, { status: 400 });

    const [group] = await sql`
      INSERT INTO coupon_groups (salon_id, name, value, note, created_by)
      VALUES (${user.salon_id}, ${name.trim()}, ${Number(value)}, ${note?.trim() || null}, ${user.id})
      RETURNING *`;

    return NextResponse.json(group, { status: 201 });
  } catch (err) {
    console.error('POST /api/coupons/groups error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
