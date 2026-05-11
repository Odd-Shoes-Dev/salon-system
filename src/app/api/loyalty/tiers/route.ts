import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/loyalty/tiers
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await sql`
      SELECT * FROM loyalty_tiers
      WHERE salon_id = ${user.salon_id} AND is_active = true
      ORDER BY points_required ASC`;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Loyalty tiers GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
