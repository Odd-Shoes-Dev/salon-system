import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

// GET /api/dashboard/stats - Get dashboard statistics
export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's revenue
    const { data: todayVisits } = await supabase
      .from('visits')
      .select('total_amount')
      .eq('salon_id', user.salon_id)
      .gte('created_at', today);
    
    const todayRevenue = todayVisits?.reduce((sum, visit) => sum + visit.total_amount, 0) || 0;
    
    // Get total clients
    const { count: totalClients } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('salon_id', user.salon_id);
    
    // Get active services
    const { count: activeServices } = await supabase
      .from('services')
      .select('*', { count: 'exact', head: true })
      .eq('salon_id', user.salon_id)
      .eq('is_active', true);
    
    // Get loyalty members (clients with points)
    const { count: loyaltyMembers } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('salon_id', user.salon_id)
      .gt('loyalty_points', 0);
    
    // Get monthly revenue
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const { data: monthVisits } = await supabase
      .from('visits')
      .select('total_amount')
      .eq('salon_id', user.salon_id)
      .gte('created_at', firstDayOfMonth);
    
    const monthlyRevenue = monthVisits?.reduce((sum, visit) => sum + visit.total_amount, 0) || 0;
    
    // Get popular services
    const { data: popularServices } = await supabase
      .from('visit_services')
      .select(`
        service_id,
        service:services(name),
        quantity
      `)
      .eq('services.salon_id', user.salon_id)
      .limit(5);
    
    return NextResponse.json({
      todayRevenue,
      totalClients: totalClients || 0,
      activeServices: activeServices || 0,
      loyaltyMembers: loyaltyMembers || 0,
      monthlyRevenue,
      popularServices: popularServices || [],
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
