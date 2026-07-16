-- SMS campaign log: one row per campaign run
CREATE TABLE IF NOT EXISTS sms_campaigns (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id         UUID        NOT NULL REFERENCES salons(id),
  created_by       UUID        REFERENCES staff(id),
  name             TEXT,
  segment_type     TEXT        NOT NULL,   -- 'last_7_days' | 'last_30_days' | 'not_30_60' | 'not_60_plus' | 'never_visited' | 'custom'
  segment_params   JSONB,                  -- { last_visit_after, last_visit_before } for custom
  message_template TEXT        NOT NULL,
  recipient_count  INT         NOT NULL DEFAULT 0,
  sent_count       INT         NOT NULL DEFAULT 0,
  failed_count     INT         NOT NULL DEFAULT 0,
  status           TEXT        NOT NULL DEFAULT 'sending',  -- 'sending' | 'completed' | 'failed'
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);

-- Per-client message log for each campaign
CREATE TABLE IF NOT EXISTS sms_campaign_messages (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         UUID        NOT NULL REFERENCES sms_campaigns(id) ON DELETE CASCADE,
  client_id           UUID        REFERENCES clients(id) ON DELETE SET NULL,
  phone               TEXT        NOT NULL,
  client_name         TEXT,
  message_text        TEXT        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'pending',  -- 'sent' | 'failed'
  provider_message_id TEXT,
  error               TEXT,
  sent_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sms_campaigns_salon ON sms_campaigns (salon_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_campaign_messages_campaign ON sms_campaign_messages (campaign_id);
