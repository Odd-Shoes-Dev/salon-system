import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

// DELETE /api/visits/[id] - Soft delete a transaction
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only owners and admins can void transactions' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const supabase = await createClient();

    const { data: visit, error: visitError } = await supabase
      .from('visits')
      .select('id, salon_id, client_id, total_amount, points_earned, is_active')
      .eq('id', id)
      .eq('salon_id', user.salon_id)
      .single();

    if (visitError || !visit || !visit.is_active) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, loyalty_points, total_spent, total_visits')
      .eq('id', visit.client_id)
      .eq('salon_id', user.salon_id)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Related client not found' },
        { status: 404 }
      );
    }

    const { error: archiveError } = await supabase
      .from('visits')
      .update({
        is_active: false,
        status: 'voided',
        voided_at: new Date().toISOString(),
        voided_by: user.id,
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('salon_id', user.salon_id)
      .eq('is_active', true);

    if (archiveError) {
      console.error('Error archiving transaction:', archiveError);
      return NextResponse.json(
        { error: 'Failed to delete transaction' },
        { status: 500 }
      );
    }

    const nextPoints = Math.max(0, Number(client.loyalty_points || 0) - Number(visit.points_earned || 0));
    const nextTotalSpent = Math.max(0, Number(client.total_spent || 0) - Number(visit.total_amount || 0));
    const nextVisits = Math.max(0, Number(client.total_visits || 0) - 1);

    const { error: clientUpdateError } = await supabase
      .from('clients')
      .update({
        loyalty_points: nextPoints,
        total_spent: nextTotalSpent,
        total_visits: nextVisits,
        updated_at: new Date().toISOString(),
      })
      .eq('id', client.id)
      .eq('salon_id', user.salon_id);

    if (clientUpdateError) {
      console.error('Error updating client after transaction delete:', clientUpdateError);
      return NextResponse.json(
        { error: 'Transaction archived but client totals update failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Visits DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
