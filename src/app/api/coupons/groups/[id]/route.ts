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
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Only owners and admins can delete coupon groups' }, { status: 403 });
    }

    const { id } = await params;

    const [active] = await sql`
      SELECT COUNT(*)::int AS cnt FROM coupons
      WHERE group_id = ${id} AND salon_id = ${user.salon_id} AND status = 'active'`;

    if (active.cnt > 0) {
      return NextResponse.json({ error: 'Cancel all active coupons in this group before deleting it' }, { status: 400 });
    }

    await sql`
      UPDATE coupon_groups SET is_active = false
      WHERE id = ${id} AND salon_id = ${user.salon_id}`;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/coupons/groups/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
