import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { generateReceiptMessage } from '@/lib/whatsapp';
import { getDefaultReceiptSmsTemplate, renderSmsTemplate, sendSms } from '@/lib/esms';
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
    const clientId = searchParams.get('client_id');
    const paymentMethod = searchParams.get('payment_method');
    const search = searchParams.get('search');
    const paginated = searchParams.get('paginated') === 'true';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));
    const limit = parseInt(searchParams.get('limit') || '50');
    
    const supabase = await createClient();
    const applyDateFilter = (query: any) => {
      if (date === 'today') {
        const today = new Date().toISOString().split('T')[0];
        return query.gte('created_at', today);
      }

      if (date === 'week') {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        return query.gte('created_at', weekStart.toISOString());
      }

      if (date === 'month') {
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        return query.gte('created_at', monthStart.toISOString());
      }

      if (date && date !== 'all') {
        return query.gte('created_at', date).lt('created_at', `${date}T23:59:59`);
      }

      return query;
    };

    const applyFilters = async (query: any) => {
      query = query.eq('salon_id', user.salon_id);
      query = query.eq('is_active', true);

      query = applyDateFilter(query);

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      if (paymentMethod && paymentMethod !== 'all') {
        query = query.eq('payment_method', paymentMethod);
      }

      if (search) {
        const escaped = search.replace(/,/g, ' ').trim();
        if (escaped) {
          const { data: matchedClients } = await supabase
            .from('clients')
            .select('id')
            .eq('salon_id', user.salon_id)
            .or(`name.ilike.%${escaped}%,phone.ilike.%${escaped}%`)
            .limit(200);

          const clientIds = (matchedClients || []).map((c: any) => c.id);
          if (clientIds.length > 0) {
            query = query.or(`receipt_number.ilike.%${escaped}%,client_id.in.(${clientIds.join(',')})`);
          } else {
            query = query.ilike('receipt_number', `%${escaped}%`);
          }
        }
      }

      return query;
    };

    if (paginated) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let dataQuery = supabase
        .from('visits')
        .select(`
          *,
          client:clients(id, name, phone),
          staff:staff!visits_staff_id_fkey(id, name),
          visit_services(
            id,
            service:services(id, name, price),
            quantity,
            unit_price
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      dataQuery = await applyFilters(dataQuery);

      const { data, error, count } = await dataQuery;

      if (error) {
        console.error('Error fetching paginated visits:', error);
        return NextResponse.json(
          { error: 'Failed to fetch visits' },
          { status: 500 }
        );
      }

      let summaryQuery = supabase
        .from('visits')
        .select('total_amount, payment_method, points_earned')
        .eq('salon_id', user.salon_id);

      summaryQuery = await applyFilters(summaryQuery);

      const { data: summaryRows, error: summaryError } = await summaryQuery;

      if (summaryError) {
        console.error('Error fetching visits summary:', summaryError);
        return NextResponse.json(
          { error: 'Failed to fetch visits summary' },
          { status: 500 }
        );
      }

      const totals = (summaryRows || []).reduce(
        (acc, row: any) => {
          const amount = Number(row.total_amount || 0);
          const points = Number(row.points_earned || 0);
          acc.totalSales += amount;
          acc.pointsAwarded += points;
          acc.transactionCount += 1;

          if (row.payment_method === 'cash') acc.cashSales += amount;
          if (row.payment_method === 'mtn_mobile_money') acc.mtnSales += amount;
          if (row.payment_method === 'airtel_money') acc.airtelSales += amount;

          return acc;
        },
        {
          totalSales: 0,
          pointsAwarded: 0,
          transactionCount: 0,
          cashSales: 0,
          mtnSales: 0,
          airtelSales: 0,
        }
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
          ...totals,
          avgOrderValue: totals.transactionCount > 0 ? totals.totalSales / totals.transactionCount : 0,
        },
      });
    }

    let query = supabase
      .from('visits')
      .select(`
        *,
        client:clients(id, name, phone),
        staff:staff!visits_staff_id_fkey(id, name),
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

    query = await applyFilters(query);
    
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
      .select('name, phone, address, loyalty_points_per_ugx')
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
        is_active: true,
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
      price: serviceDetails.find(s => s.id === item.service_id)?.price || 0,
      unit_price: serviceDetails.find(s => s.id === item.service_id)?.price || 0,
    }));

    const { error: servicesError } = await supabase
      .from('visit_services')
      .insert(visitServices);
    
    if (servicesError) {
      console.error('Error creating visit services:', servicesError);
      return NextResponse.json(
        { error: `Failed to create visit services: ${servicesError.message}` },
        { status: 500 }
      );
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
    
    let smsResult: { success: boolean; error?: string; messageId?: string } | null = null;

    // Send customer receipt via SMS
    if (send_receipt && client.phone) {
      const { data: templateRow } = await supabase
        .from('message_templates')
        .select('template')
        .eq('salon_id', user.salon_id)
        .eq('name', 'receipt_sms')
        .maybeSingle();

      const template = templateRow?.template || getDefaultReceiptSmsTemplate();
      const servicesText = serviceDetails
        .map((s) => `${s.name} x${s.quantity}`)
        .join(', ');

      const smsText = renderSmsTemplate(template, {
        salonName: salon?.name || 'Salon',
        clientName: client.name || 'Client',
        services: servicesText,
        total: Number(total).toLocaleString(),
        pointsEarned: String(totalPoints),
        totalPoints: String(newPoints),
        receiptNumber,
        paymentMethod: payment_method,
      });

      try {
        const smsData = await sendSms({
          phoneNumber: client.phone,
          text: smsText,
        });

        smsResult = {
          success: true,
          messageId: smsData.messageId,
        };
      } catch (error: any) {
        console.error('SMS send failed:', error);
        smsResult = {
          success: false,
          error: error.message || 'SMS failed',
        };
      }

      // Keep existing demo WhatsApp receipt log for backward compatibility
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
        salonPhone: salon?.phone || '+256 700 000 000',
        salonAddress: salon?.address || '123 Main Street, Kampala',
      });
      
      console.log('WhatsApp Receipt (Demo Mode):', receipt);
    }
    
    return NextResponse.json({
      ...visit,
      services: serviceDetails,
      client,
      sms: smsResult,
    }, { status: 201 });
  } catch (error) {
    console.error('Visits POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
