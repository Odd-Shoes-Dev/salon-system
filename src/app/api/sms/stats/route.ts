import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { smsProvider } from '@/lib/sms';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const data = await smsProvider.getStats();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch SMS stats' }, { status: 500 });
  }
}
