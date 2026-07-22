import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Only managers and above can edit coupon groups' }, { status: 403 });
    }

    const { id } = await params;
    const { name, value, note } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    if (!value || Number(value) <= 0) return NextResponse.json({ error: 'Value must be greater than 0' }, { status: 400 });

    const [group] = await sql`
      UPDATE coupon_groups SET
        name  = ${name.trim()},
        value = ${Number(value)},
        note  = ${note?.trim() || null}
      WHERE id = ${id} AND salon_id = ${user.salon_id} AND is_active = true
      RETURNING *`;

    if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    return NextResponse.json(group);
  } catch (err) {
    console.error('PUT /api/coupons/groups/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
