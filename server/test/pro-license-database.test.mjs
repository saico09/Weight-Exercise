import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

test('license flow against a disposable PostgreSQL database (no SMTP)', { skip: process.env.RUN_LICENSE_DB_TESTS !== '1' }, () => {
  const cwd = fileURLToPath(new URL('../../', import.meta.url));
  const database = `we_license_test_${randomBytes(6).toString('hex')}`;
  const docker = (args, input) => execFileSync('docker', ['compose', '--env-file', '.env.local', 'exec', '-T', ...args], { cwd, input, encoding: 'utf8', timeout: 60000 });
  // The database is newly created here; none of the user's tables are migrated.
  docker(['db', 'createdb', '-U', 'postgres', '-O', 'we_app', database]);
  try {
    for (const file of ['02-schema.sql', '06-pro-licenses.sql', '06-pro-licenses.sql']) docker(['db', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database], readFileSync(new URL(`../db/${file}`, import.meta.url)));
    const moduleCode = readFileSync(new URL('../src/pro-license.mjs', import.meta.url), 'utf8').replace("from './security.mjs'", "from 'file:///app/server/src/security.mjs'");
    const fixture = readFileSync(new URL('./fixtures/license-database.mjs', import.meta.url), 'utf8').replace("from '../src/pro-license.mjs'", `from 'data:text/javascript;base64,${Buffer.from(moduleCode).toString('base64')}'`);
    const output = docker(['-e', `PGDATABASE=${database}`, 'api', 'node', '--input-type=module'], fixture);
    assert.match(output, /License PostgreSQL concurrency, replay, revocation and isolation passed; no email sent/);
  } finally { docker(['db', 'dropdb', '-U', 'postgres', '--force', database]); }
});
