import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/referral-sources
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await sql`
      SELECT * FROM referral_sources
      WHERE salon_id = ${user.salon_id} AND is_active = true
      ORDER BY sort_order, name`;
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/referral-sources
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { name } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const [existing] = await sql`
      SELECT id, is_active FROM referral_sources
      WHERE salon_id = ${user.salon_id} AND name = ${name.trim()}`;

    if (existing) {
      if (!existing.is_active) {
        const [restored] = await sql`
          UPDATE referral_sources SET is_active = true WHERE id = ${existing.id} RETURNING *`;
        return NextResponse.json(restored, { status: 200 });
      }
      return NextResponse.json({ error: 'Source already exists' }, { status: 409 });
    }

    const [maxOrder] = await sql`
      SELECT sort_order FROM referral_sources
      WHERE salon_id = ${user.salon_id}
      ORDER BY sort_order DESC LIMIT 1`;

    try {
      const [data] = await sql`
        INSERT INTO referral_sources (salon_id, name, sort_order)
        VALUES (${user.salon_id}, ${name.trim()}, ${(maxOrder?.sort_order ?? 0) + 1})
        RETURNING *`;
      return NextResponse.json(data, { status: 201 });
    } catch (err: any) {
      if (err.code === '23505') {
        return NextResponse.json({ error: `"${name.trim()}" already exists as a referral source` }, { status: 409 });
      }
      throw err;
    }
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/referral-sources
