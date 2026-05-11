import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/birthdays?month=5&year=2026
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const now = new Date();
    const month = parseInt(request.nextUrl.searchParams.get('month') || String(now.getMonth() + 1), 10);
    const year  = parseInt(request.nextUrl.searchParams.get('year')  || String(now.getFullYear()), 10);

    const clients = await sql`SELECT * FROM get_birthday_clients(${user.salon_id}, ${month})`;
    if (!clients.length) return NextResponse.json([]);

    const messages = await sql`
      SELECT id, client_id, message_text, discount_percent, status, sent_at
      FROM birthday_messages
      WHERE salon_id = ${user.salon_id} AND year_sent = ${year}`;

    const msgByClient: Record<string, any[]> = {};
    for (const m of messages) {
      if (!msgByClient[m.client_id]) msgByClient[m.client_id] = [];
      msgByClient[m.client_id].push(m);
    }

    const result = clients.map((c: any) => ({
      ...c,
      messages_this_year: msgByClient[c.id] || [],
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Birthdays GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
