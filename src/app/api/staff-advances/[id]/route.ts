import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

// PUT /api/staff-advances/[id] — update status (deducted / cancelled)
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

    const { id }    = await params;
    const { status } = await request.json();

    if (!['deducted', 'cancelled'].includes(status)) {
      return NextResponse.json({ error: 'status must be deducted or cancelled' }, { status: 400 });
    }

    const supabase = await createClient();

    const patch: Record<string, unknown> = { status };
    if (status === 'deducted') patch.deducted_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('staff_advances')
      .update(patch)
      .eq('id', id)
      .eq('salon_id', user.salon_id)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Advance not found or update failed' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Staff advance PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
