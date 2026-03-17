import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { sendSms } from '@/lib/esms';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['owner', 'manager', 'cashier'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const phoneNumber = (body?.phoneNumber || '').trim();
    const text = (body?.text || '').trim();

    if (!phoneNumber || !text) {
      return NextResponse.json({ error: 'phoneNumber and text are required' }, { status: 400 });
    }

    const data = await sendSms({ phoneNumber, text });
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('SMS send error:', error);
    return NextResponse.json({ error: error.message || 'Failed to send SMS' }, { status: 500 });
  }
}
