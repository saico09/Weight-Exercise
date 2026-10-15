import pg from 'pg';

// Administrative CLI only: run on the trusted backend host. No public revocation
// endpoint or client-supplied administrator flag exists.
const [userId, deviceHash] = process.argv.slice(2);
if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(userId || '') || (deviceHash && !/^[A-Za-z0-9_-]{43}$/.test(deviceHash))) {
  console.error('Usage: node scripts/revoke-pro.mjs <account-uuid> [device-key-hash]. Omit device to block the whole account.'); process.exit(1);
}
const pool = new pg.Pool({ max: 1, connectionTimeoutMillis: 3000 });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  if (!(await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId])).rowCount) throw new Error('Account unavailable.');
  if (deviceHash) {
    if (!(await client.query('UPDATE pro_devices SET revoked_at=now() WHERE user_id=$1 AND device_key_hash=$2', [userId, deviceHash])).rowCount) throw new Error('Device unavailable.');
    await client.query('DELETE FROM pro_license_challenges WHERE user_id=$1 AND device_key_hash=$2', [userId, deviceHash]);
  } else {
    await client.query('INSERT INTO pro_account_blocks(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING', [userId]);
    await client.query('UPDATE pro_devices SET revoked_at=now() WHERE user_id=$1', [userId]);
    await client.query('DELETE FROM pro_license_challenges WHERE user_id=$1', [userId]);
  }
  await client.query('COMMIT');
  console.log('Pro access revoked. Existing offline tickets expire within at most seven days. Account and records preserved.');
} catch {
  await client.query('ROLLBACK'); console.error('Revocation failed. No changes were saved.'); process.exitCode = 1;
} finally { client.release(); await pool.end(); }
