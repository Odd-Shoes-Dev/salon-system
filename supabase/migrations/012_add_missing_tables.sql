-- Add missing tables from dev environment
-- This migration adds all engagement and feedback features

-- Complaint Categories table
CREATE TABLE IF NOT EXISTS complaint_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  salon_id uuid,
  name character varying NOT NULL,
  display_name character varying NOT NULL,
  description text,
  emoji character varying,
  severity_default character varying DEFAULT 'medium'::character varying,
  auto_escalate boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

-- Feedback Responses table
CREATE TABLE IF NOT EXISTS feedback_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  salon_id uuid,
  client_id uuid,
  visit_id uuid,
  staff_id uuid,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  would_recommend boolean,
  feedback_channel character varying DEFAULT 'whatsapp'::character varying,
  responded_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL
);

-- Complaint Reports table
CREATE TABLE IF NOT EXISTS complaint_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  feedback_response_id uuid,
  salon_id uuid,
  client_id uuid,
  visit_id uuid,
  staff_id uuid,
  complaint_category character varying NOT NULL,
  complaint_text text,
  severity character varying DEFAULT 'medium'::character varying,
  status character varying DEFAULT 'pending'::character varying,
  resolution_notes text,
  resolved_by uuid,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (feedback_response_id) REFERENCES feedback_responses(id) ON DELETE CASCADE,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL,
  FOREIGN KEY (resolved_by) REFERENCES staff(id) ON DELETE SET NULL
);

-- Message Templates table
CREATE TABLE IF NOT EXISTS message_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  salon_id uuid,
  name character varying NOT NULL,
  display_name character varying NOT NULL,
  template text NOT NULL,
  trigger_type character varying NOT NULL,
  trigger_delay_days integer DEFAULT 0,
  service_category character varying,
  is_active boolean DEFAULT true,
  send_time time without time zone DEFAULT '10:00:00'::time without time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

-- Scheduled Messages table
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  salon_id uuid,
  client_id uuid,
  visit_id uuid,
  template_id uuid,
  phone_number character varying NOT NULL,
  message_content text NOT NULL,
  scheduled_for timestamp with time zone NOT NULL,
  status character varying DEFAULT 'pending'::character varying,
  attempts integer DEFAULT 0,
  max_attempts integer DEFAULT 3,
  whatsapp_message_id character varying,
  sent_at timestamp with time zone,
  delivered_at timestamp with time zone,
  read_at timestamp with time zone,
  failed_reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES message_templates(id) ON DELETE SET NULL
);

-- CS Tasks table
CREATE TABLE IF NOT EXISTS cs_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  salon_id uuid,
  client_id uuid,
  scheduled_message_id uuid,
  task_type character varying NOT NULL,
  priority character varying DEFAULT 'normal'::character varying,
  status character varying DEFAULT 'pending'::character varying,
  title character varying NOT NULL,
  description text,
  assigned_to uuid,
  due_date date,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (scheduled_message_id) REFERENCES scheduled_messages(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to) REFERENCES staff(id) ON DELETE SET NULL
);

-- Recovery Actions table
CREATE TABLE IF NOT EXISTS recovery_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  salon_id uuid,
  client_id uuid,
  visit_id uuid,
  feedback_response_id uuid,
  complaint_report_id uuid,
  action_type character varying NOT NULL,
  action_taken_by uuid,
  offer_type character varying,
  offer_amount numeric,
  offer_code character varying,
  offer_expires date,
  customer_response text,
  outcome character varying,
  customer_returned boolean DEFAULT false,
  return_visit_id uuid,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE,
  FOREIGN KEY (feedback_response_id) REFERENCES feedback_responses(id) ON DELETE CASCADE,
  FOREIGN KEY (complaint_report_id) REFERENCES complaint_reports(id) ON DELETE CASCADE,
  FOREIGN KEY (action_taken_by) REFERENCES staff(id) ON DELETE SET NULL,
  FOREIGN KEY (return_visit_id) REFERENCES visits(id) ON DELETE SET NULL
);

-- Referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  salon_id uuid,
  referrer_id uuid,
  referred_client_id uuid,
  referral_source character varying DEFAULT 'word_of_mouth'::character varying,
  referrer_phone character varying,
  referrer_name character varying,
  status character varying DEFAULT 'pending'::character varying,
  first_visit_id uuid,
  reward_points integer DEFAULT 500,
  rewarded_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE,
  FOREIGN KEY (referrer_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (referred_client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (first_visit_id) REFERENCES visits(id) ON DELETE SET NULL
);

-- Engage Settings table
CREATE TABLE IF NOT EXISTS engage_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  salon_id uuid UNIQUE,
  feedback_enabled boolean DEFAULT true,
  feedback_delay_hours integer DEFAULT 9,
  auto_recovery_enabled boolean DEFAULT true,
  manager_alert_threshold integer DEFAULT 3,
  referral_reward_points integer DEFAULT 500,
  referral_tracking_enabled boolean DEFAULT true,
  staff_performance_tracking boolean DEFAULT true,
  whatsapp_feedback_enabled boolean DEFAULT true,
  sms_feedback_fallback boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

-- Staff Performance table
CREATE TABLE IF NOT EXISTS staff_performance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  salon_id uuid,
  staff_id uuid,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_services integer DEFAULT 0,
  total_clients integer DEFAULT 0,
  avg_rating numeric,
  five_star_count integer DEFAULT 0,
  four_star_count integer DEFAULT 0,
  three_star_count integer DEFAULT 0,
  two_star_count integer DEFAULT 0,
  one_star_count integer DEFAULT 0,
  total_complaints integer DEFAULT 0,
  complaints_resolved integer DEFAULT 0,
  would_recommend_percentage numeric,
  recovery_success_count integer DEFAULT 0,
  referrals_generated integer DEFAULT 0,
  performance_score numeric,
  rank integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

-- WhatsApp Webhooks table
CREATE TABLE IF NOT EXISTS whatsapp_webhooks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  webhook_id character varying,
  message_id character varying,
  status character varying,
  timestamp timestamp with time zone,
  raw_data jsonb,
  processed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_complaint_categories_salon ON complaint_categories(salon_id);
CREATE INDEX IF NOT EXISTS idx_complaint_reports_salon ON complaint_reports(salon_id);
CREATE INDEX IF NOT EXISTS idx_complaint_reports_client ON complaint_reports(client_id);
CREATE INDEX IF NOT EXISTS idx_complaint_reports_status ON complaint_reports(status);
CREATE INDEX IF NOT EXISTS idx_feedback_responses_salon ON feedback_responses(salon_id);
CREATE INDEX IF NOT EXISTS idx_feedback_responses_client ON feedback_responses(client_id);
CREATE INDEX IF NOT EXISTS idx_feedback_responses_rating ON feedback_responses(rating);
CREATE INDEX IF NOT EXISTS idx_message_templates_salon ON message_templates(salon_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_salon ON scheduled_messages(salon_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status ON scheduled_messages(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_scheduled_for ON scheduled_messages(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_cs_tasks_salon ON cs_tasks(salon_id);
CREATE INDEX IF NOT EXISTS idx_cs_tasks_status ON cs_tasks(status);
CREATE INDEX IF NOT EXISTS idx_cs_tasks_assigned_to ON cs_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_recovery_actions_salon ON recovery_actions(salon_id);
CREATE INDEX IF NOT EXISTS idx_recovery_actions_client ON recovery_actions(client_id);
CREATE INDEX IF NOT EXISTS idx_referrals_salon ON referrals(salon_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_staff_performance_salon ON staff_performance(salon_id);
CREATE INDEX IF NOT EXISTS idx_staff_performance_staff ON staff_performance(staff_id);

-- Apply update_updated_at trigger to new tables
CREATE TRIGGER update_complaint_reports_updated_at BEFORE UPDATE ON complaint_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_message_templates_updated_at BEFORE UPDATE ON message_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_messages_updated_at BEFORE UPDATE ON scheduled_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cs_tasks_updated_at BEFORE UPDATE ON cs_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recovery_actions_updated_at BEFORE UPDATE ON recovery_actions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_referrals_updated_at BEFORE UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_engage_settings_updated_at BEFORE UPDATE ON engage_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_performance_updated_at BEFORE UPDATE ON staff_performance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
