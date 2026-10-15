BEGIN;
CREATE TABLE IF NOT EXISTS pro_license_challenges (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_key_hash text NOT NULL CHECK (length(device_key_hash)=43),
  device_public_key bytea NOT NULL CHECK (octet_length(device_public_key) BETWEEN 250 AND 400),
  request_hash text NOT NULL CHECK (length(request_hash)=43),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE(user_id,device_key_hash)
);
CREATE INDEX IF NOT EXISTS pro_license_challenges_expiry ON pro_license_challenges(expires_at);
CREATE TABLE IF NOT EXISTS pro_devices (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_key_hash text NOT NULL CHECK (length(device_key_hash)=43),
  version_code bigint NOT NULL CHECK (version_code > 0),
  verified_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  PRIMARY KEY(user_id,device_key_hash)
);
CREATE TABLE IF NOT EXISTS pro_account_blocks (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  blocked_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON pro_license_challenges,pro_devices,pro_account_blocks TO we_app;
COMMIT;
