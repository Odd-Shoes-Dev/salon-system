import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/workers — list workers, scoped to user's branch
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const activeOnly = request.nextUrl.searchParams.get('active') !== 'false';

    // Owner with no branch filter sees all; otherwise scope to branch
    const isAllBranches = user.role === 'owner' && user.branch_id === null;

    const rows = isAllBranches
      ? activeOnly
        ? await sql`SELECT w.*, b.name AS branch_name FROM workers w LEFT JOIN branches b ON b.id = w.branch_id WHERE w.salon_id = ${user.salon_id} AND w.is_active = true ORDER BY w.name`
        : await sql`SELECT w.*, b.name AS branch_name FROM workers w LEFT JOIN branches b ON b.id = w.branch_id WHERE w.salon_id = ${user.salon_id} ORDER BY w.name`
      : activeOnly
        ? await sql`SELECT w.*, b.name AS branch_name FROM workers w LEFT JOIN branches b ON b.id = w.branch_id WHERE w.salon_id = ${user.salon_id} AND w.branch_id = ${user.branch_id} AND w.is_active = true ORDER BY w.name`
        : await sql`SELECT w.*, b.name AS branch_name FROM workers w LEFT JOIN branches b ON b.id = w.branch_id WHERE w.salon_id = ${user.salon_id} AND w.branch_id = ${user.branch_id} ORDER BY w.name`;

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
    const { name, phone, email, job_title, hire_date, notes, branch_id } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Resolve branch
    let assignedBranchId: string | null = null;
    if (user.role === 'owner') {
      assignedBranchId = branch_id || user.branch_id;
    } else {
      assignedBranchId = user.branch_id;
    }

    if (assignedBranchId) {
      const [br] = await sql`SELECT id FROM branches WHERE id = ${assignedBranchId} AND salon_id = ${user.salon_id} AND deleted_at IS NULL`;
      if (!br) return NextResponse.json({ error: 'Invalid branch' }, { status: 400 });
    }

    const [newWorker] = await sql`
      INSERT INTO workers (salon_id, name, phone, email, job_title, hire_date, notes, is_active, branch_id)
      VALUES (
        ${user.salon_id}, ${name.trim()}, ${phone?.trim() || null},
        ${email?.trim() || null}, ${job_title?.trim() || 'Stylist'},
        ${hire_date || null}, ${notes?.trim() || null}, true, ${assignedBranchId}
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
    const { id, name, phone, email, job_title, hire_date, notes, is_active, branch_id } = body;

    if (!id) return NextResponse.json({ error: 'Worker ID required' }, { status: 400 });

    const [current] = user.role === 'owner' && user.branch_id === null
      ? await sql`SELECT * FROM workers WHERE id = ${id} AND salon_id = ${user.salon_id}`
      : await sql`SELECT * FROM workers WHERE id = ${id} AND salon_id = ${user.salon_id} AND branch_id = ${user.branch_id}`;

    if (!current) return NextResponse.json({ error: 'Worker not found' }, { status: 404 });

    const nameFinal     = name      !== undefined ? name.trim()              : current.name;
    const phoneFinal    = phone     !== undefined ? (phone?.trim() || null)  : current.phone;
    const emailFinal    = email     !== undefined ? (email?.trim() || null)  : current.email;
    const jobTitleFinal = job_title !== undefined ? (job_title?.trim() || 'Stylist') : current.job_title;
    const hireDateFinal = hire_date !== undefined ? (hire_date || null)      : current.hire_date;
    const notesFinal    = notes     !== undefined ? (notes?.trim() || null)  : current.notes;
    const isActiveFinal = is_active !== undefined ? is_active                : current.is_active;
    let branchFinal     = current.branch_id;

    if (branch_id !== undefined && user.role === 'owner') {
      if (branch_id !== null) {
        const [br] = await sql`SELECT id FROM branches WHERE id = ${branch_id} AND salon_id = ${user.salon_id} AND deleted_at IS NULL`;
        if (!br) return NextResponse.json({ error: 'Invalid branch' }, { status: 400 });
      }
      branchFinal = branch_id;
    }

    const [row] = await sql`
      UPDATE workers
      SET    name = ${nameFinal}, phone = ${phoneFinal}, email = ${emailFinal},
             job_title = ${jobTitleFinal}, hire_date = ${hireDateFinal}, notes = ${notesFinal},
             is_active = ${isActiveFinal}, branch_id = ${branchFinal}, updated_at = NOW()
      WHERE  id = ${id} AND salon_id = ${user.salon_id}
      RETURNING *
    `;

    return NextResponse.json(row);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/workers — soft delete (owner only)
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can remove workers' }, { status: 403 });
    }

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'Worker ID required' }, { status: 400 });

    await sql`UPDATE workers SET is_active = false, updated_at = NOW() WHERE id = ${id} AND salon_id = ${user.salon_id}`;

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
