import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

// GET /api/loyalty/tiers - List active loyalty tiers for current salon
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('loyalty_tiers')
      .select('*')
      .eq('salon_id', user.salon_id)
      .eq('is_active', true)
      .order('points_required', { ascending: true });

    if (error) {
      console.error('Error fetching loyalty tiers:', error);
      return NextResponse.json(
        { error: 'Failed to fetch loyalty tiers' },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Loyalty tiers GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
