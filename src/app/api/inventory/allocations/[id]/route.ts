import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// PUT /api/inventory/allocations/[id] — record a (partial or full) return
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const { qty_returned: rawQty, notes } = await request.json();
    const qtyReturn = Number(rawQty);

    if (!rawQty || qtyReturn <= 0) {
      return NextResponse.json({ error: 'qty_returned must be greater than zero' }, { status: 400 });
    }

    const [allocation] = await sql`
      SELECT sa.*, si.current_qty AS item_current_qty, si.branch_id AS item_branch_id, si.unit
      FROM stock_allocations sa
      JOIN stock_items si ON si.id = sa.item_id
      WHERE sa.id = ${id} AND sa.salon_id = ${user.salon_id}`;

    if (!allocation) return NextResponse.json({ error: 'Allocation not found' }, { status: 404 });
    if (allocation.status === 'closed') {
      return NextResponse.json({ error: 'Allocation is already closed' }, { status: 400 });
    }

    const alreadyReturned = Number(allocation.qty_returned);
    const totalAllocated  = Number(allocation.qty_allocated);
    const maxReturn       = totalAllocated - alreadyReturned;

    if (qtyReturn > maxReturn) {
      return NextResponse.json(
        { error: `Cannot return more than what is outstanding (${maxReturn} ${allocation.unit})` },
        { status: 400 }
      );
    }

    const newTotalReturned = alreadyReturned + qtyReturn;
    const isClosed         = newTotalReturned >= totalAllocated;
    const newStatus        = isClosed ? 'closed' : 'partial_return';

    // Update allocation
    const [updated] = await sql`
      UPDATE stock_allocations SET
        qty_returned = ${newTotalReturned},
        status       = ${newStatus},
        returned_at  = ${isClosed ? sql`NOW()` : sql`returned_at`},
        notes        = COALESCE(${notes?.trim() || null}, notes),
        updated_at   = NOW()
      WHERE id = ${id}
      RETURNING *`;

    // Add stock back and record return movement
    const newItemQty = Number(allocation.item_current_qty) + qtyReturn;
    await sql`UPDATE stock_items SET current_qty = ${newItemQty}, updated_at = NOW() WHERE id = ${allocation.item_id}`;

    await sql`
      INSERT INTO stock_movements
        (salon_id, branch_id, item_id, qty_change, qty_after, reason, notes, created_by, worker_id, allocation_id, reference_type, reference_id)
      VALUES
        (${user.salon_id}, ${allocation.item_branch_id}, ${allocation.item_id},
         ${qtyReturn}, ${newItemQty}, 'staff_return',
         ${notes?.trim() || null}, ${user.id},
         ${allocation.worker_id}, ${id}, 'allocation', ${id})`;

    return NextResponse.json({ ...updated, new_item_qty: newItemQty });
  } catch (err) {
    console.error('PUT /api/inventory/allocations/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
