import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { currentPassword, newPassword } = body;

  if (
    typeof currentPassword !== 'string' || !currentPassword ||
    typeof newPassword !== 'string'     || !newPassword
  ) {
    return NextResponse.json({ error: 'Both current and new password are required' }, { status: 400 });
  }
  if (currentPassword.length > 128 || newPassword.length > 128) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
  }

  const [staff] = await sql`SELECT password_hash FROM staff WHERE id = ${user.id}`;

  if (!staff?.password_hash) {
    return NextResponse.json(
      { error: 'No password is set on this account. Contact the salon owner.' },
      { status: 400 }
    );
  }

  const isValid = await bcrypt.compare(currentPassword, staff.password_hash);
  if (!isValid) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await sql`UPDATE staff SET password_hash = ${newHash} WHERE id = ${user.id}`;

  // Revoke all other sessions so saved passwords on other browsers stop working
  const cookieStore = await cookies();
  const currentToken = cookieStore.get('auth_token')?.value;
  if (currentToken) {
    await sql`DELETE FROM sessions WHERE staff_id = ${user.id} AND token != ${currentToken}`;
  }

  return NextResponse.json({ success: true });
}
