import { createClient } from '@/lib/supabase/server';
import { Salon } from '@/types';

/**
 * Get salon by subdomain
 * Used for multi-tenant routing
 */
export async function getSalonBySubdomain(subdomain: string): Promise<Salon | null> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('salons')
      .select('*')
      .eq('subdomain', subdomain)
      .eq('is_active', true)
      .single();
    
    if (error) {
      console.error('Error fetching salon by subdomain:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error in getSalonBySubdomain:', error);
    return null;
  }
}

/**
 * Get salon by custom domain
 * For premium clients with their own domain
 */
export async function getSalonByDomain(domain: string): Promise<Salon | null> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('salons')
      .select('*')
      .eq('custom_domain', domain)
      .eq('is_active', true)
      .single();
    
    if (error) {
      console.error('Error fetching salon by domain:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error in getSalonByDomain:', error);
    return null;
  }
}

/**
 * Get salon by ID
 */
export async function getSalonById(id: string): Promise<Salon | null> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('salons')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('Error fetching salon by ID:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error in getSalonById:', error);
    return null;
  }
}

/**
 * Check if subdomain is available
 * Used during salon registration
 */
export async function isSubdomainAvailable(subdomain: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('salons')
      .select('id')
      .eq('subdomain', subdomain)
      .maybeSingle();
    
    if (error) {
      console.error('Error checking subdomain availability:', error);
      return false;
    }
    
    return !data; // Available if no salon found
  } catch (error) {
    console.error('Error in isSubdomainAvailable:', error);
    return false;
  }
}

/**
 * Validate subdomain format
 * 3-50 characters, lowercase, alphanumeric and hyphens only
 */
export function validateSubdomainFormat(subdomain: string): {
  valid: boolean;
  error?: string;
} {
  // Reserved subdomains
  const reserved = [
    'www', 'api', 'admin', 'app', 'blueox', 'mail', 
    'ftp', 'localhost', 'staging', 'dev', 'test', 'demo'
  ];
  
  if (reserved.includes(subdomain.toLowerCase())) {
    return { valid: false, error: 'This subdomain is reserved' };
  }
  
  // Format validation
  const regex = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;
  if (!regex.test(subdomain)) {
    return { 
      valid: false, 
      error: 'Subdomain must be 3-50 characters, lowercase, alphanumeric and hyphens only' 
    };
  }
  
  return { valid: true };
}
