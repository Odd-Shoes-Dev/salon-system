import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { currentPin, newPin } = body;

  if (typeof currentPin !== 'string' || !currentPin || typeof newPin !== 'string' || !newPin) {
    return NextResponse.json({ error: 'Both current and new PIN are required' }, { status: 400 });
  }
  if (!/^\d{4}$/.test(newPin)) {
    return NextResponse.json({ error: 'New PIN must be exactly 4 digits' }, { status: 400 });
  }

  const [staff] = await sql`SELECT pin_hash FROM staff WHERE id = ${user.id}`;

  if (!staff?.pin_hash) {
    return NextResponse.json(
      { error: 'No PIN is set on this account.' },
      { status: 400 }
    );
  }

  const isValid = await bcrypt.compare(currentPin, staff.pin_hash);
  if (!isValid) {
    return NextResponse.json({ error: 'Current PIN is incorrect' }, { status: 401 });
  }

  const newHash = await bcrypt.hash(newPin, 10);
  await sql`UPDATE staff SET pin_hash = ${newHash} WHERE id = ${user.id}`;

  const cookieStore = await cookies();
  const currentToken = cookieStore.get('auth_token')?.value;
  if (currentToken) {
    await sql`DELETE FROM sessions WHERE staff_id = ${user.id} AND token != ${currentToken}`;
  }

  return NextResponse.json({ success: true });
}
