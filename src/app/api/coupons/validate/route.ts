import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const code = request.nextUrl.searchParams.get('code')?.trim().toUpperCase();
    if (!code) return NextResponse.json({ error: 'Code is required' }, { status: 400 });

    const [coupon] = await sql`
      SELECT c.*, cg.name AS group_name
      FROM coupons c
      LEFT JOIN coupon_groups cg ON cg.id = c.group_id
      WHERE c.salon_id = ${user.salon_id} AND c.code = ${code}`;

    if (!coupon) return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });
    if (coupon.status === 'cancelled') return NextResponse.json({ error: 'This coupon has been cancelled' }, { status: 400 });
    if (coupon.status === 'used') return NextResponse.json({ error: 'This coupon has already been fully used' }, { status: 400 });
    if (coupon.status === 'expired') return NextResponse.json({ error: 'This coupon has expired' }, { status: 400 });
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      await sql`UPDATE coupons SET status = 'expired' WHERE id = ${coupon.id}`;
      return NextResponse.json({ error: 'This coupon has expired' }, { status: 400 });
    }
    if (Number(coupon.remaining_value) <= 0) {
      return NextResponse.json({ error: 'This coupon has no remaining balance' }, { status: 400 });
    }

    return NextResponse.json({
      id: coupon.id,
      code: coupon.code,
      value: Number(coupon.value),
      remaining_value: Number(coupon.remaining_value),
      group_name: coupon.group_name,
      note: coupon.note,
      issued_to: coupon.issued_to,
      expires_at: coupon.expires_at,
    });
  } catch (err) {
    console.error('GET /api/coupons/validate error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
