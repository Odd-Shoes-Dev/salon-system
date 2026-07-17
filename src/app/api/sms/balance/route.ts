import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { smsProvider } from '@/lib/sms';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const data = await smsProvider.getBalance();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch balance' }, { status: 500 });
  }
}
