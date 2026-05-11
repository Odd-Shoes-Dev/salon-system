import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/workers — list all salon workers
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const activeOnly = request.nextUrl.searchParams.get('active') !== 'false';

    const rows = activeOnly
      ? await sql`SELECT * FROM workers WHERE salon_id = ${user.salon_id} AND is_active = true ORDER BY name`
      : await sql`SELECT * FROM workers WHERE salon_id = ${user.salon_id} ORDER BY name`;

    return NextResponse.json(rows);
  } catch {
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

    const [newWorker] = await sql`
      INSERT INTO workers (salon_id, name, phone, email, job_title, hire_date, notes, is_active)
      VALUES (
        ${user.salon_id},
        ${name.trim()},
        ${phone?.trim() || null},
        ${email?.trim() || null},
        ${job_title?.trim() || 'Stylist'},
        ${hire_date || null},
        ${notes?.trim() || null},
        true
      )
      RETURNING *
    `;

    return NextResponse.json(newWorker, { status: 201 });
  } catch {
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

    // Fetch current values so omitted fields keep their existing data
    const [current] = await sql`
      SELECT * FROM workers WHERE id = ${id} AND salon_id = ${user.salon_id}
    `;
    if (!current) return NextResponse.json({ error: 'Worker not found' }, { status: 404 });

    const nameFinal     = name      !== undefined ? name.trim()              : current.name;
    const phoneFinal    = phone     !== undefined ? (phone?.trim() || null)  : current.phone;
    const emailFinal    = email     !== undefined ? (email?.trim() || null)  : current.email;
    const jobTitleFinal = job_title !== undefined ? (job_title?.trim() || 'Stylist') : current.job_title;
    const hireDateFinal = hire_date !== undefined ? (hire_date || null)      : current.hire_date;
    const notesFinal    = notes     !== undefined ? (notes?.trim() || null)  : current.notes;
    const isActiveFinal = is_active !== undefined ? is_active                : current.is_active;

    const [row] = await sql`
      UPDATE workers SET
        name      = ${nameFinal},
        phone     = ${phoneFinal},
        email     = ${emailFinal},
        job_title = ${jobTitleFinal},
        hire_date = ${hireDateFinal},
        notes     = ${notesFinal},
        is_active = ${isActiveFinal},
        updated_at = NOW()
      WHERE id = ${id} AND salon_id = ${user.salon_id}
      RETURNING *
    `;

    return NextResponse.json(row);
  } catch {
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

    await sql`
      UPDATE workers SET is_active = false, updated_at = NOW()
      WHERE id = ${id} AND salon_id = ${user.salon_id}
    `;

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
