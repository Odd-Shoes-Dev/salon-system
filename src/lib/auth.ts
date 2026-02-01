import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: 'owner' | 'manager' | 'stylist' | 'cashier';
  salon_id: string;
}

/**
 * Get current authenticated user from session
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    
    if (!token) {
      return null;
    }
    
    const supabase = await createClient();
    
    // Get session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('staff_id, salon_id')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (sessionError || !session) {
      return null;
    }
    
    // Get staff details
    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('id, name, phone, email, role, salon_id')
      .eq('id', session.staff_id)
      .eq('is_active', true)
      .single();
    
    if (staffError || !staff) {
      return null;
    }
    
    return staff as AuthUser;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Login with phone and PIN
 */
export async function loginWithPin(
  phone: string,
  pin: string,
  salonId: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const supabase = await createClient();
    
    // Find staff by phone and salon
    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('id, pin_hash, salon_id, is_active')
      .eq('phone', phone)
      .eq('salon_id', salonId)
      .single();
    
    if (staffError || !staff) {
      return { success: false, error: 'Invalid phone or PIN' };
    }
    
    if (!staff.is_active) {
      return { success: false, error: 'Account is inactive' };
    }
    
    // Verify PIN
    const isValid = await bcrypt.compare(pin, staff.pin_hash);
    if (!isValid) {
      return { success: false, error: 'Invalid phone or PIN' };
    }
    
    // Create session token
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
    
    const { error: sessionError } = await supabase
      .from('sessions')
      .insert({
        staff_id: staff.id,
        salon_id: staff.salon_id,
        token,
        expires_at: expiresAt.toISOString(),
      });
    
    if (sessionError) {
      return { success: false, error: 'Failed to create session' };
    }
    
    // Update last login
    await supabase
      .from('staff')
      .update({ last_login: new Date().toISOString() })
      .eq('id', staff.id);
    
    return { success: true, token };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Login failed' };
  }
}

/**
 * Login with email and password
 */
export async function loginWithPassword(
  email: string,
  password: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const supabase = await createClient();
    
    // Find staff by email
    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('id, password_hash, salon_id, is_active')
      .eq('email', email)
      .single();
    
    if (staffError || !staff) {
      return { success: false, error: 'Invalid email or password' };
    }
    
    if (!staff.is_active) {
      return { success: false, error: 'Account is inactive' };
    }
    
    if (!staff.password_hash) {
      return { success: false, error: 'Password login not enabled for this account' };
    }
    
    // Verify password
    const isValid = await bcrypt.compare(password, staff.password_hash);
    if (!isValid) {
      return { success: false, error: 'Invalid email or password' };
    }
    
    // Create session token
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
    
    const { error: sessionError } = await supabase
      .from('sessions')
      .insert({
        staff_id: staff.id,
        salon_id: staff.salon_id,
        token,
        expires_at: expiresAt.toISOString(),
      });
    
    if (sessionError) {
      return { success: false, error: 'Failed to create session' };
    }
    
    // Update last login
    await supabase
      .from('staff')
      .update({ last_login: new Date().toISOString() })
      .eq('id', staff.id);
    
    return { success: true, token };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Login failed' };
  }
}

/**
 * Logout - destroy session
 */
export async function logout(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    
    if (token) {
      const supabase = await createClient();
      await supabase.from('sessions').delete().eq('token', token);
    }
  } catch (error) {
    console.error('Logout error:', error);
  }
}

/**
 * Hash PIN for storage
 */
export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

/**
 * Hash password for storage
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Generate random token
 */
function generateToken(): string {
  return Array.from({ length: 32 }, () =>
    Math.random().toString(36).charAt(2)
  ).join('');
}

/**
 * Check if user has permission for action
 */
export function hasPermission(user: AuthUser, action: string): boolean {
  const permissions: Record<string, string[]> = {
    'manage_staff': ['owner'],
    'manage_services': ['owner', 'manager'],
    'manage_clients': ['owner', 'manager'],
    'view_reports': ['owner', 'manager'],
    'use_pos': ['owner', 'manager', 'stylist', 'cashier'],
  };
  
  return permissions[action]?.includes(user.role) || false;
}
