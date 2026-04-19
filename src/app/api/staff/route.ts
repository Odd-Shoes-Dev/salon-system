import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getCurrentUser, canChangeRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = await createClient();

    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('id, name, phone, email, role, is_active, last_login, created_at')
      .eq('salon_id', user.salon_id)
      .order('created_at', { ascending: false });

    if (staffError) throw staffError;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const staffWithStats = await Promise.all(
      (staff || []).map(async (member: any) => {
        const { data: todayVisits } = await supabase
          .from('visits')
          .select('total_amount')
          .eq('staff_id', member.id)
          .gte('created_at', today.toISOString());

        const { data: weekVisits } = await supabase
          .from('visits')
          .select('total_amount')
          .eq('staff_id', member.id)
          .gte('created_at', weekAgo.toISOString());

        return {
          ...member,
          today_sales: todayVisits?.reduce((s: number, v: any) => s + v.total_amount, 0) || 0,
          today_visits: todayVisits?.length || 0,
          week_sales: weekVisits?.reduce((s: number, v: any) => s + v.total_amount, 0) || 0,
          week_visits: weekVisits?.length || 0,
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

    if (user.role !== 'owner' && user.role !== 'admin') {
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

    // Prevent creating owner accounts
    if (role === 'owner') {
      return NextResponse.json(
        { error: 'Cannot create another account owner' },
        { status: 403 }
      );
    }

    // Admins cannot create other admins — only owner can
    if (role === 'admin' && user.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only the account owner can create admin accounts' },
        { status: 403 }
      );
    }

    if (!pin && !password) {
      return NextResponse.json(
        { error: 'At least a PIN or password is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check for duplicate phone within salon
    const { data: existing } = await supabase
      .from('staff')
      .select('id')
      .eq('salon_id', user.salon_id)
      .eq('phone', phone)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'A staff member with this phone number already exists' },
        { status: 409 }
      );
    }

    const pin_hash = pin ? await bcrypt.hash(pin, 10) : null;
    const password_hash = password ? await bcrypt.hash(password, 10) : null;

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
      .select('id, name, phone, email, role, is_active, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
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

    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, phone, email, role, is_active, reset_pin, new_pin, new_password } = body;

    if (!id) {
      return NextResponse.json({ error: 'Staff ID is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch the target staff member to check their current role
    const { data: target, error: fetchError } = await supabase
      .from('staff')
      .select('id, role')
      .eq('id', id)
      .eq('salon_id', user.salon_id)
      .single();

    if (fetchError || !target) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    // Owner's record is immutable — no one can edit it
    if (target.role === 'owner') {
      return NextResponse.json(
        { error: 'The account owner cannot be modified' },
        { status: 403 }
      );
    }

    // Check role change permission
    if (role !== undefined && !canChangeRole(user, target.role)) {
      return NextResponse.json(
        { error: 'You do not have permission to change this staff member\'s role' },
        { status: 403 }
      );
    }

    // Nobody can promote anyone to owner
    if (role === 'owner') {
      return NextResponse.json(
        { error: 'Cannot assign the owner role' },
        { status: 403 }
      );
    }

    // Admin cannot promote to admin — only owner can
    if (role === 'admin' && user.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only the account owner can assign the admin role' },
        { status: 403 }
      );
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (is_active !== undefined) updateData.is_active = is_active;

    if (reset_pin) {
      updateData.pin_hash = await bcrypt.hash('1234', 10);
    }

    if (new_pin) {
      if (!/^\d{4}$/.test(new_pin)) {
        return NextResponse.json({ error: 'PIN must be exactly 4 digits' }, { status: 400 });
      }
      updateData.pin_hash = await bcrypt.hash(new_pin, 10);
    }

    if (new_password) {
      updateData.password_hash = await bcrypt.hash(new_password, 10);
    }

    const { data, error } = await supabase
      .from('staff')
      .update(updateData)
      .eq('id', id)
      .eq('salon_id', user.salon_id)
      .select('id, name, phone, email, role, is_active, last_login, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error updating staff:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
