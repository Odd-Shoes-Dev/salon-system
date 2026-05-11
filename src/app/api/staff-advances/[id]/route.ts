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
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Only owners and admins can update advances' }, { status: 403 });
    }

    const { id }     = await params;
    const { status } = await request.json();

    if (!['deducted', 'cancelled'].includes(status)) {
      return NextResponse.json({ error: 'status must be deducted or cancelled' }, { status: 400 });
    }

    const [data] = status === 'deducted'
      ? await sql`UPDATE staff_advances SET status = 'deducted', deducted_at = NOW() WHERE id = ${id} AND salon_id = ${user.salon_id} RETURNING *`
      : await sql`UPDATE staff_advances SET status = 'cancelled' WHERE id = ${id} AND salon_id = ${user.salon_id} RETURNING *`;

    if (!data) return NextResponse.json({ error: 'Advance not found or update failed' }, { status: 404 });
    return NextResponse.json(data);
  } catch (error) {
    console.error('Staff advance PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
