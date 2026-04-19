import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

// GET /api/workers — list all salon workers
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createClient();
    const activeOnly = request.nextUrl.searchParams.get('active') !== 'false';

    let query = supabase
      .from('workers')
      .select('*')
      .eq('salon_id', user.salon_id)
      .order('name');

    if (activeOnly) query = query.eq('is_active', true);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: 'Failed to fetch workers' }, { status: 500 });

    return NextResponse.json(data || []);
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/workers — create a new worker (owner/admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, phone, email, job_title, hire_date, notes } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('workers')
      .insert({
        salon_id: user.salon_id,
        name: name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        job_title: job_title?.trim() || 'Stylist',
        hire_date: hire_date || null,
        notes: notes?.trim() || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: 'Failed to create worker' }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/workers — update a worker (owner/admin only)
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, phone, email, job_title, hire_date, notes, is_active } = body;

    if (!id) return NextResponse.json({ error: 'Worker ID required' }, { status: 400 });

    const supabase = await createClient();
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name.trim();
    if (phone !== undefined) updates.phone = phone?.trim() || null;
    if (email !== undefined) updates.email = email?.trim() || null;
    if (job_title !== undefined) updates.job_title = job_title?.trim() || 'Stylist';
    if (hire_date !== undefined) updates.hire_date = hire_date || null;
    if (notes !== undefined) updates.notes = notes?.trim() || null;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data, error } = await supabase
      .from('workers')
      .update(updates)
      .eq('id', id)
      .eq('salon_id', user.salon_id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: 'Failed to update worker' }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/workers — soft delete a worker (owner only)
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can remove workers' }, { status: 403 });
    }

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'Worker ID required' }, { status: 400 });

    const supabase = await createClient();
    const { error } = await supabase
      .from('workers')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('salon_id', user.salon_id);

    if (error) return NextResponse.json({ error: 'Failed to remove worker' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
