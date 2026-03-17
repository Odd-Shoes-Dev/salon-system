-- Ensure one template name per salon for safe upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_message_templates_salon_name
ON message_templates (salon_id, name);
