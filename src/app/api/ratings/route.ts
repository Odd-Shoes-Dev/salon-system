import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

// POST /api/ratings - Submit a client rating for a visit
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { visit_id, worker_id, client_id, rating, comment } = body;

    if (!visit_id || !worker_id || !client_id || !rating) {
      return NextResponse.json(
        { error: 'visit_id, worker_id, client_id and rating are required' },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify visit belongs to this salon
    const { data: visit, error: visitError } = await supabase
      .from('visits')
      .select('id, salon_id, client_id')
      .eq('id', visit_id)
      .eq('salon_id', user.salon_id)
      .single();

    if (visitError || !visit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    }

    // Upsert rating (in case staff submits twice)
    const { data, error } = await supabase
      .from('staff_ratings')
      .upsert({
        salon_id: user.salon_id,
        visit_id,
        worker_id,
        client_id,
        rating,
        comment: comment?.trim() || null,
      }, { onConflict: 'visit_id' })
      .select()
      .single();

    if (error) {
      console.error('Error saving rating:', error);
      return NextResponse.json({ error: 'Failed to save rating' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Ratings POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
