-- Production RLS: Replace permissive demo policies with deny-by-default.
-- All legitimate access comes through Next.js API routes using the service role key,
-- which bypasses RLS entirely. Direct anon/browser access is blocked.

-- Drop old permissive demo policies
DROP POLICY IF EXISTS "Allow all for demo" ON salons;
DROP POLICY IF EXISTS "Allow all for demo" ON clients;
DROP POLICY IF EXISTS "Allow all for demo" ON services;
DROP POLICY IF EXISTS "Allow all for demo" ON staff;
DROP POLICY IF EXISTS "Allow all for demo" ON visits;
DROP POLICY IF EXISTS "Allow all for demo" ON visit_services;
DROP POLICY IF EXISTS "Allow all for demo" ON loyalty_tiers;
DROP POLICY IF EXISTS "Allow all for demo" ON whatsapp_messages;
DROP POLICY IF EXISTS "Allow all for demo" ON service_categories;

-- Drop policies on tables added in later migrations (012)
DROP POLICY IF EXISTS "Allow all for demo" ON complaint_categories;
DROP POLICY IF EXISTS "Allow all for demo" ON feedback_responses;
DROP POLICY IF EXISTS "Allow all for demo" ON complaint_reports;
DROP POLICY IF EXISTS "Allow all for demo" ON message_templates;
DROP POLICY IF EXISTS "Allow all for demo" ON scheduled_messages;
DROP POLICY IF EXISTS "Allow all for demo" ON cs_tasks;
DROP POLICY IF EXISTS "Allow all for demo" ON recovery_actions;
DROP POLICY IF EXISTS "Allow all for demo" ON referrals;
DROP POLICY IF EXISTS "Allow all for demo" ON engage_settings;
DROP POLICY IF EXISTS "Allow all for demo" ON staff_performance;
DROP POLICY IF EXISTS "Allow all for demo" ON whatsapp_webhooks;
DROP POLICY IF EXISTS "Allow all for demo" ON sessions;

-- No new policies needed: RLS is enabled on all tables with zero policies,
-- which means direct anon key access is fully blocked.
-- The service role key (used by createClient() in server.ts) bypasses RLS,
-- so all server-side API routes continue to work without any policy.
