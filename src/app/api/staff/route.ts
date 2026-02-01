import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Get all staff for the salon with performance stats
    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('*')
      .eq('salon_id', user.salon_id)
      .order('created_at', { ascending: false });

    if (staffError) throw staffError;

    // Get performance stats for each staff member
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const staffWithStats = await Promise.all(
      (staff || []).map(async (member: any) => {
        // Today's stats
        const { data: todayVisits } = await supabase
          .from('visits')
          .select('total_amount')
          .eq('staff_id', member.id)
          .gte('created_at', today.toISOString());

        // Week's stats
        const { data: weekVisits } = await supabase
          .from('visits')
          .select('total_amount')
          .eq('staff_id', member.id)
          .gte('created_at', weekAgo.toISOString());

        const today_sales = todayVisits?.reduce((sum: number, v: any) => sum + v.total_amount, 0) || 0;
        const today_visits = todayVisits?.length || 0;
        const week_sales = weekVisits?.reduce((sum: number, v: any) => sum + v.total_amount, 0) || 0;
        const week_visits = weekVisits?.length || 0;

        return {
          ...member,
          today_sales,
          today_visits,
          week_sales,
          week_visits,
        };
      })
    );

    return NextResponse.json(staffWithStats);
  } catch (error: any) {
    console.error('Error loading staff:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only owners can manage staff
    if (user.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, phone, email, role, pin, password } = body;

    if (!name || !phone || !role) {
      return NextResponse.json(
        { error: 'Name, phone, and role are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Hash PIN and password if provided
    const bcrypt = require('bcryptjs');
    const pin_hash = pin ? await bcrypt.hash(pin, 10) : null;
    const password_hash = password ? await bcrypt.hash(password, 10) : null;

    // Create staff member
    const { data, error } = await supabase
      .from('staff')
      .insert({
        salon_id: user.salon_id,
        name,
        phone,
        email: email || null,
        role,
        pin_hash,
        password_hash,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error creating staff:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only owners can manage staff
    if (user.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, phone, email, role, is_active, reset_pin } = body;

    if (!id) {
      return NextResponse.json({ error: 'Staff ID is required' }, { status: 400 });
    }

    const supabase = await createClient();

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (is_active !== undefined) updateData.is_active = is_active;

    // Reset PIN to default if requested
    if (reset_pin) {
      const bcrypt = require('bcryptjs');
      updateData.pin_hash = await bcrypt.hash('1234', 10);
    }

    const { data, error } = await supabase
      .from('staff')
      .update(updateData)
      .eq('id', id)
      .eq('salon_id', user.salon_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error updating staff:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
