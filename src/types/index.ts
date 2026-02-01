// Core database types for Salon System

export interface Salon {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  logo_url?: string;
  subdomain?: string; // e.g., 'elite' for elite.blueox.com
  custom_domain?: string; // e.g., 'elitesalon.com'
  theme_primary_color: string; // Hex color
  theme_secondary_color: string; // Hex color
  loyalty_points_per_ugx: number; // Points earned per 1000 UGX spent
  loyalty_threshold: number; // Points needed for free service
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
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  // Relations
  client?: Client;
  staff?: Staff;
  services?: VisitService[];
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
  role: 'owner' | 'manager' | 'stylist' | 'cashier';
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
