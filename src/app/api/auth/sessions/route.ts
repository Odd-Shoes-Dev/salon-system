import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { cookies } from 'next/headers';

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cookieStore = await cookies();
  const currentToken = cookieStore.get('auth_token')?.value;

  if (currentToken) {
    await sql`DELETE FROM sessions WHERE staff_id = ${user.id} AND token != ${currentToken}`;
  } else {
    await sql`DELETE FROM sessions WHERE staff_id = ${user.id}`;
  }

  return NextResponse.json({ success: true });
}
