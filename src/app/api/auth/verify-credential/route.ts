import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// POST /api/auth/verify-credential
// Verifies the current user's PIN or password for re-authentication gates.
// Tries PIN hash first, then password hash — whichever the user has set.
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { credential } = body;

    if (!credential || typeof credential !== 'string' || credential.length > 128) {
      return NextResponse.json({ error: 'Invalid credential' }, { status: 400 });
    }

    const [staff] = await sql`
      SELECT pin_hash, password_hash FROM staff WHERE id = ${user.id}
    `;

    if (!staff) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    let valid = false;
    if (staff.pin_hash) {
      valid = await bcrypt.compare(credential, staff.pin_hash);
    }
    if (!valid && staff.password_hash) {
      valid = await bcrypt.compare(credential, staff.password_hash);
    }

    if (!valid) {
      return NextResponse.json({ error: 'Incorrect PIN or password' }, { status: 401 });
    }

    return NextResponse.json({ valid: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
