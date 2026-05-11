import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const gender   = searchParams.get('gender');
    const showAll  = searchParams.get('showAll') === 'true';

    const data = showAll && category
      ? await sql`SELECT * FROM services WHERE salon_id = ${user.salon_id} AND category = ${category} ORDER BY name LIMIT 500`
      : showAll && gender && gender !== 'all'
      ? await sql`SELECT * FROM services WHERE salon_id = ${user.salon_id} AND (gender_target = ${gender} OR gender_target = 'unisex') ORDER BY name LIMIT 500`
      : showAll
      ? await sql`SELECT * FROM services WHERE salon_id = ${user.salon_id} ORDER BY name LIMIT 500`
      : category && gender && gender !== 'all'
      ? await sql`SELECT * FROM services WHERE salon_id = ${user.salon_id} AND is_active = true AND category = ${category} AND (gender_target = ${gender} OR gender_target = 'unisex') ORDER BY name LIMIT 500`
      : category
      ? await sql`SELECT * FROM services WHERE salon_id = ${user.salon_id} AND is_active = true AND category = ${category} ORDER BY name LIMIT 500`
      : gender && gender !== 'all'
      ? await sql`SELECT * FROM services WHERE salon_id = ${user.salon_id} AND is_active = true AND (gender_target = ${gender} OR gender_target = 'unisex') ORDER BY name LIMIT 500`
      : await sql`SELECT * FROM services WHERE salon_id = ${user.salon_id} AND is_active = true ORDER BY name LIMIT 500`;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Services GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'owner' && user.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, category, price, duration_minutes, description, gender_target } = await request.json();
    if (!name || !price) return NextResponse.json({ error: 'Name and price are required' }, { status: 400 });

    const [data] = await sql`
      INSERT INTO services (salon_id, name, category, price, duration_minutes, description, gender_target, is_active)
      VALUES (${user.salon_id}, ${name}, ${category || 'Other'}, ${price}, ${duration_minutes || 60}, ${description || null}, ${gender_target || 'unisex'}, true)
      RETURNING *`;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Services POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/services - List services for the salon
