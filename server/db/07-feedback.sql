BEGIN;
CREATE TABLE IF NOT EXISTS feedback_challenges (
  id uuid PRIMARY KEY,
  token_hash text NOT NULL CHECK (length(token_hash)=64),
  ip_hash text NOT NULL CHECK (length(ip_hash)=64),
  answer_hash text NOT NULL CHECK (length(answer_hash)=64),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS feedback_challenges_expiry ON feedback_challenges(expires_at);
CREATE TABLE IF NOT EXISTS feedback_dedup (
  message_hash text PRIMARY KEY CHECK (length(message_hash)=64),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS feedback_dedup_expiry ON feedback_dedup(expires_at);
GRANT SELECT,INSERT,UPDATE,DELETE ON feedback_challenges,feedback_dedup TO we_app;
COMMIT;
