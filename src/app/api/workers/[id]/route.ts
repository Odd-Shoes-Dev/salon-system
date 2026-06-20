import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const [row] = await sql`
      SELECT w.*, b.name AS branch_name
      FROM workers w
      LEFT JOIN branches b ON b.id = w.branch_id
      WHERE w.id = ${id} AND w.salon_id = ${user.salon_id}
    `;

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json(row);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
