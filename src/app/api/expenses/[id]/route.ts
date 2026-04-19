import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

// ── PUT /api/expenses/[id] ────────────────────────────────────
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body   = await request.json();
    const { category, amount, description, expense_date } = body;

    if (!category?.trim()) return NextResponse.json({ error: 'Category is required' }, { status: 400 });
    if (!amount || Number(amount) <= 0) return NextResponse.json({ error: 'Amount must be > 0' }, { status: 400 });

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('expenses')
      .update({
        category:     category.trim(),
        amount:       Number(amount),
        description:  description?.trim() || null,
        expense_date: expense_date,
        updated_at:   new Date().toISOString(),
      })
      .eq('id', id)
      .eq('salon_id', user.salon_id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error('PUT /api/expenses/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── DELETE /api/expenses/[id] (soft delete) ───────────────────
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Only owners and admins can delete expenses' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = await createClient();
    await supabase
      .from('expenses')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('salon_id', user.salon_id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/expenses/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
