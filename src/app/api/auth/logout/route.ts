import { NextResponse } from 'next/server';
import { logout } from '@/lib/auth';

export async function POST() {
  try {
    await logout();
    
    const response = NextResponse.json(
      { success: true },
      { status: 200 }
    );
    
    // Clear auth cookie
    response.cookies.delete('auth_token');
    
    return response;
  } catch (error) {
    console.error('Logout API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
