import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

// GET /api/clients/[id] - Get single client
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .eq('salon_id', user.salon_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Client not found' },
          { status: 404 }
        );
      }

      console.error('Error fetching client:', error);
      return NextResponse.json(
        { error: 'Failed to fetch client' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Client GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/clients/[id] - Update a client
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { name, phone, email, birthday } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { error: 'Name and phone are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    // Update the client
    const { data, error } = await supabase
      .from('clients')
      .update({
        name,
        phone,
        email,
        birthday,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('salon_id', user.salon_id) // Ensure client belongs to this salon
      .eq('is_active', true)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      console.error('Error updating client:', error);
      return NextResponse.json(
        { error: 'Failed to update client' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Client update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/clients/[id] - Soft delete a client
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (user.role !== 'owner' && user.role !== 'manager') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const supabase = await createClient();
    
    const now = new Date().toISOString();

    const { data: client, error: clientLookupError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', id)
      .eq('salon_id', user.salon_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .single();

    if (clientLookupError || !client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    const { error: visitsError } = await supabase
      .from('visits')
      .update({
        is_active: false,
        deleted_at: now,
        deleted_by: user.id,
        updated_at: now,
      })
      .eq('salon_id', user.salon_id)
      .eq('client_id', id)
      .eq('is_active', true)
      .is('deleted_at', null);

    if (visitsError) {
      console.error('Error deleting client visits:', visitsError);
      return NextResponse.json(
        { error: 'Failed to delete related transactions' },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from('clients')
      .update({
        is_active: false,
        deleted_at: now,
        loyalty_points: 0,
        total_visits: 0,
        total_spent: 0,
        last_visit: null,
        updated_at: now,
      })
      .eq('id', id)
      .eq('salon_id', user.salon_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .select('id')
      .single();

    if (error) {
      console.error('Error deleting client:', error);
      return NextResponse.json(
        { error: 'Failed to delete client' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Client delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
