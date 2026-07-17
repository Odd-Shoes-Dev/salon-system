import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { smsProvider } from '@/lib/sms';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status') || undefined;
    const page   = Number(searchParams.get('page')  ?? 0);
    const limit  = Number(searchParams.get('limit') ?? 25);
    const data = await smsProvider.getMessages({ status, page, limit });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch messages' }, { status: 500 });
  }
}
