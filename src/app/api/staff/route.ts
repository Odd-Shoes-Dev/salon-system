import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getCurrentUser, canChangeRole } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const staff = await sql`
      SELECT id, name, phone, email, role, is_active, last_login, created_at
      FROM staff
      WHERE salon_id = ${user.salon_id}
      ORDER BY created_at DESC
    `;

    if (staff.length === 0) {
      return NextResponse.json([]);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const staffIds = staff.map((m: any) => m.id);

    const statsRows = await sql`
      SELECT
        staff_id,
        COALESCE(SUM(CASE WHEN created_at >= ${today.toISOString()} THEN total_amount ELSE 0 END), 0) AS today_sales,
        COUNT(CASE WHEN created_at >= ${today.toISOString()} THEN 1 END)::int AS today_visits,
        COALESCE(SUM(CASE WHEN created_at >= ${weekAgo.toISOString()} THEN total_amount ELSE 0 END), 0) AS week_sales,
        COUNT(CASE WHEN created_at >= ${weekAgo.toISOString()} THEN 1 END)::int AS week_visits
      FROM visits
      WHERE staff_id = ANY(${staffIds})
      GROUP BY staff_id
    `;

    const statsMap = new Map(statsRows.map((r: any) => [r.staff_id, r]));

    const staffWithStats = staff.map((member: any) => {
      const stats = statsMap.get(member.id);
      return {
        ...member,
        today_sales: Number(stats?.today_sales ?? 0),
        today_visits: Number(stats?.today_visits ?? 0),
        week_sales: Number(stats?.week_sales ?? 0),
        week_visits: Number(stats?.week_visits ?? 0),
      };
    });

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

    if (role === 'owner') {
      return NextResponse.json(
        { error: 'Cannot create another account owner' },
        { status: 403 }
      );
    }

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

    const emailParam = email || null;

    // Check for duplicate phone or email within salon
    const [existing] = await sql`
      SELECT id, phone, email FROM staff
      WHERE salon_id = ${user.salon_id}
        AND (phone = ${phone} OR (${emailParam} IS NOT NULL AND email = ${emailParam}))
      LIMIT 1
    `;

    if (existing) {
      const field = emailParam && existing.email === emailParam ? 'email address' : 'phone number';
      return NextResponse.json(
        { error: `A staff member with this ${field} already exists` },
        { status: 409 }
      );
    }

    const pin_hash = pin ? await bcrypt.hash(pin, 10) : null;
    const password_hash = password ? await bcrypt.hash(password, 10) : null;

    try {
      const [data] = await sql`
        INSERT INTO staff
          (salon_id, name, phone, email, role, pin_hash, password_hash, is_active)
        VALUES
          (${user.salon_id}, ${name}, ${phone}, ${emailParam}, ${role},
           ${pin_hash}, ${password_hash}, true)
        RETURNING id, name, phone, email, role, is_active, created_at
      `;
      return NextResponse.json(data, { status: 201 });
    } catch (err: any) {
      if (err.code === '23505') {
        const field = err.message?.includes('email') ? 'email address' : 'phone number';
        return NextResponse.json(
          { error: `A staff account with this ${field} already exists` },
          { status: 409 }
        );
      }
      throw err;
    }
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

    // Fetch the target staff member
    const [target] = await sql`
      SELECT id, name, phone, email, role, is_active, pin_hash, password_hash
      FROM staff
      WHERE id = ${id} AND salon_id = ${user.salon_id}
    `;

    if (!target) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    if (target.role === 'owner') {
      return NextResponse.json(
        { error: 'The account owner cannot be modified' },
        { status: 403 }
      );
    }

    if (role !== undefined && !canChangeRole(user, target.role)) {
      return NextResponse.json(
        { error: "You do not have permission to change this staff member's role" },
        { status: 403 }
      );
    }

    if (role === 'owner') {
      return NextResponse.json({ error: 'Cannot assign the owner role' }, { status: 403 });
    }

    if (role === 'admin' && user.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only the account owner can assign the admin role' },
        { status: 403 }
      );
    }

    if (new_pin && !/^\d{4}$/.test(new_pin)) {
      return NextResponse.json({ error: 'PIN must be exactly 4 digits' }, { status: 400 });
    }

    // Compute final field values (merge patch fields over current)
    const finalName = name !== undefined ? name : target.name;
    const finalPhone = phone !== undefined ? phone : target.phone;
    const finalEmail = email !== undefined ? email : target.email;
    const finalRole = role !== undefined ? role : target.role;
    const finalIsActive = is_active !== undefined ? is_active : target.is_active;

    let finalPinHash = target.pin_hash;
    let finalPasswordHash = target.password_hash;
    if (reset_pin) finalPinHash = await bcrypt.hash('1234', 10);
    if (new_pin) finalPinHash = await bcrypt.hash(new_pin, 10);
    if (new_password) finalPasswordHash = await bcrypt.hash(new_password, 10);

    const [data] = await sql`
      UPDATE staff
      SET name = ${finalName}, phone = ${finalPhone}, email = ${finalEmail},
          role = ${finalRole}, is_active = ${finalIsActive},
          pin_hash = ${finalPinHash}, password_hash = ${finalPasswordHash}
      WHERE id = ${id} AND salon_id = ${user.salon_id}
      RETURNING id, name, phone, email, role, is_active, last_login, created_at
    `;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error updating staff:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
