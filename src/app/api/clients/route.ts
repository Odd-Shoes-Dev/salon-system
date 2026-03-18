import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

// GET /api/clients - List clients for the salon
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const paginated = searchParams.get('paginated') === 'true';
    const sort = searchParams.get('sort');
    const minPointsParam = searchParams.get('minPoints');
    const minPoints = minPointsParam ? Math.max(0, parseInt(minPointsParam, 10)) : null;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));
    
    const supabase = await createClient();
    if (paginated) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let dataQuery = supabase
        .from('clients')
        .select('*', { count: 'exact' })
        .eq('salon_id', user.salon_id)
        .eq('is_active', true)
        .is('deleted_at', null)
        .range(from, to);

      if (sort === 'loyalty_points_desc') {
        dataQuery = dataQuery.order('loyalty_points', { ascending: false }).order('name');
      } else {
        dataQuery = dataQuery.order('name');
      }

      if (search) {
        dataQuery = dataQuery.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
      }

      if (minPoints !== null && !Number.isNaN(minPoints)) {
        dataQuery = dataQuery.gte('loyalty_points', minPoints);
      }

      const { data, error, count } = await dataQuery;

      if (error) {
        console.error('Error fetching paginated clients:', error);
        return NextResponse.json(
          { error: 'Failed to fetch clients' },
          { status: 500 }
        );
      }

      let summaryQuery = supabase
        .from('clients')
        .select('total_spent, total_visits, loyalty_points')
        .eq('salon_id', user.salon_id)
        .eq('is_active', true)
        .is('deleted_at', null);

      if (search) {
        summaryQuery = summaryQuery.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
      }

      if (minPoints !== null && !Number.isNaN(minPoints)) {
        summaryQuery = summaryQuery.gte('loyalty_points', minPoints);
      }

      const { data: summaryRows, error: summaryError } = await summaryQuery;

      if (summaryError) {
        console.error('Error fetching client summary:', summaryError);
        return NextResponse.json(
          { error: 'Failed to fetch clients summary' },
          { status: 500 }
        );
      }

      const totals = (summaryRows || []).reduce(
        (acc, row) => {
          acc.totalSpent += Number(row.total_spent || 0);
          acc.totalVisits += Number(row.total_visits || 0);
          acc.totalPoints += Number(row.loyalty_points || 0);
          return acc;
        },
        { totalSpent: 0, totalVisits: 0, totalPoints: 0 }
      );

      const total = count || 0;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));

      return NextResponse.json({
        data: data || [],
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
        },
        summary: {
          totalClients: total,
          totalSpent: totals.totalSpent,
          totalVisits: totals.totalVisits,
          totalPoints: totals.totalPoints,
        },
      });
    }

    let query = supabase
      .from('clients')
      .select('*')
      .eq('salon_id', user.salon_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name');

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching clients:', error);
      return NextResponse.json(
        { error: 'Failed to fetch clients' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Clients GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/clients - Create new client
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { name, phone, email, birthday } = body;
    
    // Validate required fields
    if (!name || !phone) {
      return NextResponse.json(
        { error: 'Name and phone are required' },
        { status: 400 }
      );
    }
    
    const supabase = await createClient();
    
    // Check if client already exists
    const { data: existing } = await supabase
      .from('clients')
      .select('id, is_active, deleted_at')
      .eq('salon_id', user.salon_id)
      .eq('phone', phone)
      .single();
    
    if (existing) {
      if (!existing.is_active || existing.deleted_at) {
        const { data: restoredClient, error: restoreError } = await supabase
          .from('clients')
          .update({
            name,
            phone,
            email: email || null,
            birthday: birthday || null,
            is_active: true,
            deleted_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .eq('salon_id', user.salon_id)
          .select()
          .single();

        if (restoreError) {
          console.error('Error restoring client:', restoreError);
          return NextResponse.json(
            { error: 'Failed to restore existing client' },
            { status: 500 }
          );
        }

        return NextResponse.json(restoredClient, { status: 200 });
      }

      return NextResponse.json(
        { error: 'Client with this phone already exists' },
        { status: 409 }
      );
    }
    
    // Create client
    const { data, error } = await supabase
      .from('clients')
      .insert({
        salon_id: user.salon_id,
        name,
        phone,
        email: email || null,
        birthday: birthday || null,
        loyalty_points: 0,
        total_visits: 0,
        total_spent: 0,
        is_active: true,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating client:', error);
      return NextResponse.json(
        { error: 'Failed to create client' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Clients POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
