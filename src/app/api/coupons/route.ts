import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function genCode(): string {
  const seg = () => Array.from({ length: 4 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
  return `${seg()}-${seg()}-${seg()}`;
}

async function uniqueCode(salonId: string): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = genCode();
    const [exists] = await sql`SELECT 1 FROM coupons WHERE salon_id = ${salonId} AND code = ${code}`;
    if (!exists) return code;
  }
  throw new Error('Failed to generate unique code after 10 attempts');
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const groupId = searchParams.get('group_id');
    const status  = searchParams.get('status');
    const search  = searchParams.get('search');

    const coupons = await sql`
      SELECT c.*, cg.name AS group_name, s.name AS issued_by_name,
        COALESCE(
          json_agg(json_build_object(
            'id', cr.id, 'amount_used', cr.amount_used,
            'remaining_after', cr.remaining_after, 'redeemed_at', cr.redeemed_at,
            'visit_id', cr.visit_id
          ) ORDER BY cr.redeemed_at DESC) FILTER (WHERE cr.id IS NOT NULL),
          '[]'
        ) AS redemptions
      FROM coupons c
      LEFT JOIN coupon_groups cg ON cg.id = c.group_id
      LEFT JOIN staff s ON s.id = c.issued_by
      LEFT JOIN coupon_redemptions cr ON cr.coupon_id = c.id
      WHERE c.salon_id = ${user.salon_id}
        AND (${groupId}::uuid IS NULL OR c.group_id = ${groupId}::uuid)
        AND (${status}::text IS NULL OR c.status = ${status}::text)
        AND (${search}::text IS NULL OR c.code ILIKE ${'%' + (search || '') + '%'} OR c.note ILIKE ${'%' + (search || '') + '%'} OR c.issued_to ILIKE ${'%' + (search || '') + '%'})
      GROUP BY c.id, cg.name, s.name
      ORDER BY c.created_at DESC
      LIMIT 200`;

    return NextResponse.json(coupons);
  } catch (err) {
    console.error('GET /api/coupons error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Only managers and above can generate coupons' }, { status: 403 });
    }

    const { group_id, value, count = 1, note, expires_at, issued_to } = await request.json();

    let resolvedValue = Number(value);

    if (group_id) {
      const [group] = await sql`SELECT * FROM coupon_groups WHERE id = ${group_id} AND salon_id = ${user.salon_id} AND is_active = true`;
      if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
      resolvedValue = Number(group.value);
    }

    if (!resolvedValue || resolvedValue <= 0) {
      return NextResponse.json({ error: 'Value must be greater than 0' }, { status: 400 });
    }

    const qty = Math.min(Math.max(1, Math.floor(Number(count))), 500);
    const generated: any[] = [];

    for (let i = 0; i < qty; i++) {
      const code = await uniqueCode(user.salon_id);
      const [coupon] = await sql`
        INSERT INTO coupons (salon_id, group_id, code, value, remaining_value, note, expires_at, issued_to, issued_by)
        VALUES (
          ${user.salon_id}, ${group_id || null}, ${code}, ${resolvedValue}, ${resolvedValue},
          ${note?.trim() || null}, ${expires_at || null}, ${issued_to?.trim() || null}, ${user.id}
        )
        RETURNING *`;
      generated.push(coupon);
    }

    return NextResponse.json(generated, { status: 201 });
  } catch (err) {
    console.error('POST /api/coupons error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
