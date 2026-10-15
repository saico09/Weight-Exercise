BEGIN;
ALTER TABLE weight_records ADD COLUMN IF NOT EXISTS steps integer CHECK (steps IS NULL OR steps BETWEEN 0 AND 200000);
CREATE TABLE IF NOT EXISTS email_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  cadence text NOT NULL DEFAULT 'weekly' CHECK (cadence IN ('weekly','monthly')),
  timezone text NOT NULL DEFAULT 'UTC',
  send_time text NOT NULL DEFAULT '09:00',
  weekday integer NOT NULL DEFAULT 1 CHECK (weekday BETWEEN 0 AND 6),
  month_day integer NOT NULL DEFAULT 1 CHECK (month_day BETWEEN 1 AND 28),
  next_send_at timestamptz,
  last_sent_at timestamptz,
  consent_at timestamptz,
  unsubscribe_version uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_preferences_due ON email_preferences(next_send_at) WHERE enabled;
CREATE TABLE IF NOT EXISTS email_deliveries (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,scheduled_for)
);
CREATE INDEX IF NOT EXISTS email_deliveries_due ON email_deliveries(next_attempt_at) WHERE status IN ('pending','sending');
GRANT SELECT, INSERT, UPDATE, DELETE ON email_preferences,email_deliveries TO we_app;
COMMIT;
