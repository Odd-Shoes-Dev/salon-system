import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

// GET /api/birthdays?month=5&year=2026
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const now = new Date();
    const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1), 10);
    const year  = parseInt(searchParams.get('year')  || String(now.getFullYear()), 10);

    const supabase = await createClient();

    // Use RPC to filter by birth month server-side via EXTRACT(MONTH FROM birthday)
    const { data: clients, error: clientsError } = await supabase
      .rpc('get_birthday_clients', { p_salon_id: user.salon_id, p_month: month });

    if (clientsError) {
      console.error('Birthday clients fetch error:', clientsError);
      return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
    }

    if (!clients || clients.length === 0) return NextResponse.json([]);

    // Birthday messages already sent this year for this salon
    const { data: messages } = await supabase
      .from('birthday_messages')
      .select('id, client_id, message_text, discount_percent, status, sent_at')
      .eq('salon_id', user.salon_id)
      .eq('year_sent', year);

    const msgByClient: Record<string, any[]> = {};
    for (const m of messages || []) {
      if (!msgByClient[m.client_id]) msgByClient[m.client_id] = [];
      msgByClient[m.client_id].push(m);
    }

    const result = (clients as any[]).map(c => ({
      ...c,
      messages_this_year: msgByClient[c.id] || [],
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Birthdays GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
