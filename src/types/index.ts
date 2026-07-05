// Core database types for Salon System

export interface Salon {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  logo_url?: string;
  slogan?: string; // Salon tagline or slogan
  subdomain?: string; // e.g., 'elite' for elite.blueox.com
  custom_domain?: string; // e.g., 'elitesalon.com'
  theme_primary_color: string; // Hex color
  theme_secondary_color: string; // Hex color
  loyalty_points_per_ugx: number; // Points earned per 1000 UGX spent
  loyalty_threshold: number; // Points needed for free service
  require_confirm_sensitive?: boolean;
  require_confirm_general?: boolean;
  is_active: boolean;
  subscription_plan: 'trial' | 'basic' | 'pro' | 'enterprise';
  subscription_expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  salon_id: string;
  name: string;
  phone: string;
  email?: string;
  birthday?: string;
  loyalty_points: number;
  total_visits: number;
  total_spent: number;
  last_visit?: string;
  notes?: string;
  referral_source_id?: string | null;
  referred_by_client_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  salon_id: string;
  name: string;
  description?: string;
  price: number;
  duration_minutes: number;
  category?: string;
  gender_target: 'male' | 'female' | 'unisex';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceCategory {
  id: string;
  salon_id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  service_count?: number;
}

export interface Visit {
  id: string;
  salon_id: string;
  client_id: string;
  staff_id?: string;
  receipt_number: string;
  total_amount: number;
  payment_method: 'mtn' | 'airtel' | 'cash';
  payment_status: 'pending' | 'completed' | 'failed';
  transaction_id?: string;
  points_earned: number;
  points_redeemed: number;
  whatsapp_sent: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Branch info
  branch_id?: string;
  branch_name?: string;
  // Relations
  client?: Client;
  staff?: Staff;
  services?: VisitService[];
  visit_services?: VisitService[]; // Alias for services (database naming)
}

export interface VisitService {
  id: string;
  visit_id: string;
  service_id: string;
  quantity: number;
  price: number;
  created_at: string;
  // Relations
  service?: Service;
}

export interface Staff {
  id: string;
  salon_id: string;
  name: string;
  phone: string;
  role: 'owner' | 'admin' | 'staff' | 'viewer' | 'manager';
  email?: string;
  is_active: boolean;
  daily_sales_target?: number;
  daily_sales?: number; // Actual daily sales (resets daily)
  commission_rate?: number;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyTier {
  id: string;
  salon_id: string;
  name: string;
  points_required: number;
  reward_description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppMessage {
  id: string;
  salon_id: string;
  visit_id?: string;
  client_id: string;
  phone_number: string;
  message: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  message_id?: string;
  error?: string;
  created_at: string;
  updated_at: string;
}

// Dashboard stats
export interface DashboardStats {
  todaySales: number;
  totalClients: number;
  todayVisits: number;
  topService: {
    name: string;
    count: number;
  } | null;
  loyaltyRedemptions: number;
  averageSpend: number;
}

// POS types
export interface CartItem {
  service: Service;
  quantity: number;
}

export interface CheckoutData {
  client: Client;
  items: CartItem[];
  total: number;
  pointsToEarn: number;
  redeemPoints: number;
  paymentMethod: 'mtn' | 'airtel' | 'cash';
  phoneNumber?: string;
}

// ─── Booking types ────────────────────────────────────────────
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export interface Booking {
  id: string;
  salon_id: string;
  client_id?: string;
  guest_name?: string;
  guest_phone?: string;
  staff_id: string;
  service_id: string;
  booking_date: string;  // YYYY-MM-DD
  start_time: string;    // HH:MM
  end_time: string;      // HH:MM
  status: BookingStatus;
  notes?: string;
  cancellation_reason?: string;
  reminder_sent: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  service_name?: string;
  service_duration?: number;
  service_price?: number;
  staff_name?: string;
  client_name?: string;
  client_phone?: string;
}

export interface BookingSettings {
  id?: string;
  salon_id: string;
  is_enabled: boolean;
  buffer_minutes: number;
  advance_booking_days: number;
  min_advance_minutes: number;
  cancellation_hours: number;
  working_hours_start: string; // HH:MM
  working_hours_end: string;   // HH:MM
  created_at?: string;
  updated_at?: string;
}

export interface StaffSchedule {
  id: string;
  salon_id: string;
  staff_id: string;
  staff_name?: string;
  day_of_week: number; // 0=Sunday … 6=Saturday
  start_time: string;  // HH:MM
  end_time: string;    // HH:MM
  is_available: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface StaffAvailability {
  staff_id: string;
  staff_name: string;
  slots: string[]; // HH:MM list
}
