import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// PUT /api/referral-sources/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const [current] = await sql`SELECT * FROM referral_sources WHERE id = ${id} AND salon_id = ${user.salon_id}`;
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const [data] = await sql`
      UPDATE referral_sources SET
        name       = ${typeof body.name === 'string' && body.name.trim() ? body.name.trim() : current.name},
        is_active  = ${typeof body.is_active === 'boolean' ? body.is_active : current.is_active},
        sort_order = ${typeof body.sort_order === 'number' ? body.sort_order : current.sort_order}
      WHERE id = ${id} AND salon_id = ${user.salon_id}
      RETURNING *`;
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/referral-sources/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    await sql`UPDATE referral_sources SET is_active = false WHERE id = ${id} AND salon_id = ${user.salon_id}`;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
