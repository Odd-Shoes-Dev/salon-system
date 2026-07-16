import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { smsProvider } from '@/lib/sms';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { searchParams } = request.nextUrl;
    const page  = Number(searchParams.get('page')  ?? 0);
    const limit = Number(searchParams.get('limit') ?? 20);
    const data = await smsProvider.getTransactions({ page, limit });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch transactions' }, { status: 500 });
  }
}
