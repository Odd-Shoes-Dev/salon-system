import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

// GET /api/staff-advances?status=pending
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const status = request.nextUrl.searchParams.get('status');
    const supabase = await createClient();

    let query = supabase
      .from('staff_advances')
      .select('id, amount, reason, status, created_at, deducted_at, staff_id, given_by')
      .eq('salon_id', user.salon_id)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data: advances, error } = await query;
    if (error) {
      console.error('Staff advances GET error:', error);
      return NextResponse.json({ error: 'Failed to fetch advances' }, { status: 500 });
    }

    if (!advances || advances.length === 0) return NextResponse.json([]);

    // Enrich with staff names
    const staffIds = [...new Set(advances.map(a => a.staff_id))];
    const { data: staffList } = await supabase
      .from('staff')
      .select('id, name')
      .in('id', staffIds);

    const staffMap: Record<string, string> = {};
    for (const s of staffList || []) staffMap[s.id] = s.name;

    const result = advances.map(a => ({
      ...a,
      staff_name: staffMap[a.staff_id] || 'Unknown',
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Staff advances GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/staff-advances — give a new advance
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Only owners and admins can give advances' }, { status: 403 });
    }

    const { staff_id, amount, reason } = await request.json();

    if (!staff_id) return NextResponse.json({ error: 'Staff member is required' }, { status: 400 });
    if (!amount || amount <= 0) return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });

    const supabase = await createClient();

    // Verify staff belongs to salon
    const { data: staffMember } = await supabase
      .from('staff')
      .select('id, name')
      .eq('id', staff_id)
      .eq('salon_id', user.salon_id)
      .single();

    if (!staffMember) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });

    // Create advance record
    const { data: advance, error: advErr } = await supabase
      .from('staff_advances')
      .insert({
        salon_id: user.salon_id,
        staff_id,
        amount:   Math.round(Number(amount)),
        reason:   reason?.trim() || null,
        given_by: user.id,
        status:   'pending',
      })
      .select()
      .single();

    if (advErr) {
      console.error('Staff advance POST error:', advErr);
      return NextResponse.json({ error: 'Failed to record advance' }, { status: 500 });
    }

    // Record as 'out' transaction from the Cash account (non-fatal)
    try {
      const { data: cashAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('salon_id', user.salon_id)
        .eq('type', 'cash')
        .eq('is_system', true)
        .maybeSingle();

      if (cashAccount) {
        await supabase.from('account_transactions').insert({
          salon_id:         user.salon_id,
          account_id:       cashAccount.id,
          amount:           Math.round(Number(amount)),
          direction:        'out',
          description:      `Advance to ${staffMember.name}${reason ? ': ' + reason : ''}`,
          reference_type:   'advance',
          reference_id:     advance.id,
          recorded_by:      user.id,
          transaction_date: new Date().toISOString().split('T')[0],
        });
      }
    } catch (txErr) {
      console.error('Advance account transaction error (non-fatal):', txErr);
    }

    return NextResponse.json({ ...advance, staff_name: staffMember.name }, { status: 201 });
  } catch (error) {
    console.error('Staff advance POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
