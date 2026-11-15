import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

type Params = { params: Promise<{ timeOffId: string }> };

// DELETE /api/workers/time-off/[timeOffId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { timeOffId } = await params;
    const [row] = await sql`
      DELETE FROM staff_time_off
      WHERE id = ${timeOffId} AND salon_id = ${user.salon_id}
      RETURNING id
    `;
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/workers/time-off/[timeOffId] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
