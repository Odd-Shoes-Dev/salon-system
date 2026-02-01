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
    
    const supabase = await createClient();
    let query = supabase
      .from('clients')
      .select('*')
      .eq('salon_id', user.salon_id)
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
      .select('id')
      .eq('salon_id', user.salon_id)
      .eq('phone', phone)
      .single();
    
    if (existing) {
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
