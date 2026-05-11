import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// DELETE /api/visits/[id] - Soft delete a transaction
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can void transactions' }, { status: 403 });
    }

    const { id } = await params;

    const [visit] = await sql`
      SELECT id, client_id, total_amount, points_earned, is_active FROM visits
      WHERE id = ${id} AND salon_id = ${user.salon_id}`;

    if (!visit || !visit.is_active) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const [client] = await sql`
      SELECT id, loyalty_points, total_spent, total_visits FROM clients
      WHERE id = ${visit.client_id} AND salon_id = ${user.salon_id}`;

    if (!client) return NextResponse.json({ error: 'Related client not found' }, { status: 404 });

    await sql`
      UPDATE visits SET
        is_active = false, status = 'voided',
        voided_at = NOW(), voided_by = ${user.id},
        deleted_at = NOW(), deleted_by = ${user.id}, updated_at = NOW()
      WHERE id = ${id} AND salon_id = ${user.salon_id} AND is_active = true`;

    const nextPoints    = Math.max(0, Number(client.loyalty_points || 0) - Number(visit.points_earned || 0));
    const nextTotalSpent = Math.max(0, Number(client.total_spent || 0) - Number(visit.total_amount || 0));
    const nextVisits    = Math.max(0, Number(client.total_visits || 0) - 1);

    await sql`
      UPDATE clients SET
        loyalty_points = ${nextPoints},
        total_spent    = ${nextTotalSpent},
        total_visits   = ${nextVisits},
        updated_at     = NOW()
      WHERE id = ${client.id} AND salon_id = ${user.salon_id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Visits DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
