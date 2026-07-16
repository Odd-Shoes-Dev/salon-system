import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Only managers and above can cancel coupons' }, { status: 403 });
    }

    const { id } = await params;

    const [coupon] = await sql`
      UPDATE coupons SET status = 'cancelled'
      WHERE id = ${id} AND salon_id = ${user.salon_id} AND status = 'active'
      RETURNING *`;

    if (!coupon) return NextResponse.json({ error: 'Coupon not found or already inactive' }, { status: 404 });

    return NextResponse.json(coupon);
  } catch (err) {
    console.error('DELETE /api/coupons/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
