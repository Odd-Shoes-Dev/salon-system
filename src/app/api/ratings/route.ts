import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// POST /api/ratings
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { visit_id, worker_id, client_id, rating, comment } = await request.json();
    if (!visit_id || !worker_id || !client_id || !rating) {
      return NextResponse.json({ error: 'visit_id, worker_id, client_id and rating are required' }, { status: 400 });
    }
    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
    }

    const [visit] = await sql`SELECT id FROM visits WHERE id = ${visit_id} AND salon_id = ${user.salon_id}`;
    if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });

    const [data] = await sql`
      INSERT INTO staff_ratings (salon_id, visit_id, worker_id, client_id, rating, comment)
      VALUES (${user.salon_id}, ${visit_id}, ${worker_id}, ${client_id}, ${rating}, ${comment?.trim() || null})
      ON CONFLICT (visit_id) DO UPDATE SET
        worker_id = EXCLUDED.worker_id,
        rating    = EXCLUDED.rating,
        comment   = EXCLUDED.comment
      RETURNING *`;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Ratings POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
