import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';


export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const workerId   = searchParams.get('worker_id');
    const statusParam = searchParams.get('status');
    const branchId   = user.branch_id;

    // Resolve status filter in JS so we pass a concrete value or null
    const statusFilter = !statusParam || statusParam === 'all' ? null : statusParam;

    const data = await sql`
      SELECT
        sa.*,
        json_build_object('id', w.id, 'name', w.name, 'job_title', w.job_title) AS worker,
        json_build_object('id', si.id, 'name', si.name, 'unit', si.unit)         AS item,
        s.name AS allocated_by_name
      FROM stock_allocations sa
      JOIN workers w      ON w.id  = sa.worker_id
      JOIN stock_items si ON si.id = sa.item_id
      LEFT JOIN staff s   ON s.id  = sa.allocated_by
      WHERE sa.salon_id = ${user.salon_id}
        AND (${branchId}::uuid   IS NULL OR sa.branch_id = ${branchId}::uuid)
        AND (${workerId}::uuid   IS NULL OR sa.worker_id = ${workerId}::uuid)
        AND (${statusFilter}::text IS NULL OR sa.status  = ${statusFilter}::text)
      ORDER BY sa.allocated_at DESC
      LIMIT 200`;

    return NextResponse.json(data);
  } catch (err) {
    console.error('GET /api/inventory/allocations error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { worker_id, item_id, qty_allocated, notes } = await request.json();
    if (!worker_id) return NextResponse.json({ error: 'worker_id is required' }, { status: 400 });
    if (!item_id)   return NextResponse.json({ error: 'item_id is required' },   { status: 400 });
    if (!qty_allocated || Number(qty_allocated) <= 0) {
      return NextResponse.json({ error: 'qty_allocated must be greater than zero' }, { status: 400 });
    }

    const qty = Number(qty_allocated);
    const branchId = user.branch_id;

    // Verify item exists in scope and has enough stock
    const [item] = await sql`
      SELECT id, name, unit, current_qty, branch_id
      FROM stock_items
      WHERE id = ${item_id} AND salon_id = ${user.salon_id}
        AND is_active = true AND deleted_at IS NULL
        AND (${branchId}::uuid IS NULL OR branch_id = ${branchId}::uuid)`;

    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    if (Number(item.current_qty) < qty) {
      return NextResponse.json({ error: `Insufficient stock — only ${item.current_qty} ${item.unit} available` }, { status: 400 });
    }

    // Verify worker belongs to this salon
    const [worker] = await sql`
      SELECT id FROM workers WHERE id = ${worker_id} AND salon_id = ${user.salon_id} AND is_active = true`;
    if (!worker) return NextResponse.json({ error: 'Worker not found' }, { status: 404 });

    // Create allocation record
    const [allocation] = await sql`
      INSERT INTO stock_allocations
        (salon_id, branch_id, worker_id, item_id, qty_allocated, notes, allocated_by)
      VALUES
        (${user.salon_id}, ${item.branch_id}, ${worker_id}, ${item_id},
         ${qty}, ${notes?.trim() || null}, ${user.id})
      RETURNING *`;

    // Deduct from stock and record the movement
    const newQty = Number(item.current_qty) - qty;
    await sql`UPDATE stock_items SET current_qty = ${newQty}, updated_at = NOW() WHERE id = ${item_id}`;

    await sql`
      INSERT INTO stock_movements
        (salon_id, branch_id, item_id, qty_change, qty_after, reason, notes, created_by, worker_id, allocation_id, reference_type, reference_id)
      VALUES
        (${user.salon_id}, ${item.branch_id}, ${item_id}, ${-qty}, ${newQty},
         'staff_loan', ${notes?.trim() || null}, ${user.id},
         ${worker_id}, ${allocation.id}, 'allocation', ${allocation.id})`;

    // Return allocation with joins
    const [withJoins] = await sql`
      SELECT
        sa.*,
        json_build_object('id', w.id, 'name', w.name, 'job_title', w.job_title) AS worker,
        json_build_object('id', si.id, 'name', si.name, 'unit', si.unit)         AS item,
        s.name AS allocated_by_name
      FROM stock_allocations sa
      JOIN workers w      ON w.id  = sa.worker_id
      JOIN stock_items si ON si.id = sa.item_id
      LEFT JOIN staff s   ON s.id  = sa.allocated_by
      WHERE sa.id = ${allocation.id}`;

    return NextResponse.json(withJoins, { status: 201 });
  } catch (err) {
    console.error('POST /api/inventory/allocations error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
