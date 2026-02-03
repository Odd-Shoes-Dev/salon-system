import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { generateReceiptMessage } from '@/lib/whatsapp';
import { generateReceiptNumber } from '@/lib/utils';

// GET /api/visits - List visits for the salon
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
    const date = searchParams.get('date');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    const supabase = await createClient();
    let query = supabase
      .from('visits')
      .select(`
        *,
        client:clients(id, name, phone),
        staff:staff(id, name),
        visit_services(
          id,
          service:services(id, name, price),
          quantity,
          unit_price
        )
      `)
      .eq('salon_id', user.salon_id)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (date === 'today') {
      const today = new Date().toISOString().split('T')[0];
      query = query.gte('created_at', today);
    } else if (date) {
      query = query.gte('created_at', date).lt('created_at', `${date}T23:59:59`);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching visits:', error);
      return NextResponse.json(
        { error: 'Failed to fetch visits' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Visits GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/visits - Create new visit (transaction)
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
    const { client_id, services, payment_method, send_receipt } = body;
    
    // Validate required fields
    if (!client_id || !services || services.length === 0 || !payment_method) {
      return NextResponse.json(
        { error: 'Client, services, and payment method are required' },
        { status: 400 }
      );
    }
    
    const supabase = await createClient();
    
    // Get client details
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', client_id)
      .eq('salon_id', user.salon_id)
      .single();
    
    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }
    
    // Calculate total and points
    let total = 0;
    
    interface ServiceDetail {
      id: string;
      name: string;
      price: number;
      quantity: number;
    }
    
    const serviceDetails: ServiceDetail[] = [];
    for (const item of services) {
      const { data: service } = await supabase
        .from('services')
        .select('*')
        .eq('id', item.service_id)
        .eq('salon_id', user.salon_id)
        .single();
      
      if (service) {
        const quantity = item.quantity || 1;
        total += service.price * quantity;
        serviceDetails.push({
          id: service.id,
          name: service.name,
          price: service.price,
          quantity,
        });
      }
    }
    
    // Get salon for receipt number and loyalty calculation
    const { data: salon } = await supabase
      .from('salons')
      .select('name, loyalty_points_per_ugx')
      .eq('id', user.salon_id)
      .single();
    
    // Calculate loyalty points based on total purchase amount
    const loyaltyRate = salon?.loyalty_points_per_ugx || 10; // Default: 10 points per 1000 UGX
    const totalPoints = Math.floor((total / 1000) * loyaltyRate);
    
    const receiptNumber = generateReceiptNumber(salon?.name || 'SALON');
    
    // Create visit
    const { data: visit, error: visitError } = await supabase
      .from('visits')
      .insert({
        salon_id: user.salon_id,
        client_id,
        staff_id: user.id,
        total_amount: total,
        payment_method,
        points_earned: totalPoints,
        receipt_number: receiptNumber,
      })
      .select()
      .single();
    
    if (visitError) {
      console.error('Error creating visit:', visitError);
      return NextResponse.json(
        { error: 'Failed to create visit' },
        { status: 500 }
      );
    }
    
    // Create visit services
    const visitServices = services.map((item: any) => ({
      visit_id: visit.id,
      service_id: item.service_id,
      quantity: item.quantity || 1,
      unit_price: serviceDetails.find(s => s.id === item.service_id)?.price || 0,
    }));
    
    const { error: servicesError } = await supabase
      .from('visit_services')
      .insert(visitServices);
    
    if (servicesError) {
      console.error('Error creating visit services:', servicesError);
    }
    
    // Update client points and stats
    const newPoints = (client.loyalty_points || 0) + totalPoints;
    const { error: updateError } = await supabase
      .from('clients')
      .update({ 
        loyalty_points: newPoints,
        total_spent: (client.total_spent || 0) + total,
        total_visits: (client.total_visits || 0) + 1,
      })
      .eq('id', client_id);
    
    if (updateError) {
      console.error('Error updating client:', updateError);
    } else {
      console.log(`Updated client ${client_id}: ${totalPoints} points added, new total: ${newPoints}`);
    }
    
    // Send WhatsApp receipt (demo mode)
    if (send_receipt && client.phone) {
      const receipt = generateReceiptMessage({
        receiptNumber,
        clientName: client.name,
        services: serviceDetails.map(s => ({
          name: s.name,
          price: s.price,
          quantity: s.quantity,
        })),
        total,
        paymentMethod: payment_method,
        pointsEarned: totalPoints,
        totalPoints: newPoints,
        salonName: salon?.name || 'Salon',
        salonPhone: '+256 700 000 000',
        salonAddress: '123 Main Street, Kampala',
      });
      
      console.log('WhatsApp Receipt (Demo Mode):', receipt);
    }
    
    return NextResponse.json({
      ...visit,
      services: serviceDetails,
      client,
    }, { status: 201 });
  } catch (error) {
    console.error('Visits POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
