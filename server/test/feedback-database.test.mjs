import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

test('feedback anti-spam against disposable PostgreSQL with fake mail only', { skip: process.env.RUN_FEEDBACK_DB_TESTS !== '1' }, () => {
  const database = `we_feedback_test_${randomBytes(6).toString('hex')}`;
  const dbContainer = process.env.FEEDBACK_TEST_DB_CONTAINER || 'weight-exercise-local-db-1';
  const apiContainer = process.env.FEEDBACK_TEST_API_CONTAINER || 'weight-exercise-local-api-1';
  const docker = (args, input) => execFileSync('docker', ['exec', '-i', ...args], { input, encoding: 'utf8', timeout: 60000 });
  // Credentials are used only by the container's existing pg environment. No env
  // file is read, no user tables are changed, and no real mailer is instantiated.
  docker([dbContainer, 'createdb', '-U', 'postgres', '-O', 'we_app', database]);
  try {
    for (const file of ['02-schema.sql', '07-feedback.sql', '07-feedback.sql']) docker([dbContainer, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database], readFileSync(new URL(`../db/${file}`, import.meta.url)));
    const securityUrl = `data:text/javascript;base64,${Buffer.from(readFileSync(new URL('../src/security.mjs', import.meta.url), 'utf8')).toString('base64')}`;
    const moduleCode = readFileSync(new URL('../src/feedback.mjs', import.meta.url), 'utf8').replace("from './security.mjs'", `from '${securityUrl}'`);
    const fixture = readFileSync(new URL('./fixtures/feedback-database.mjs', import.meta.url), 'utf8').replace("from '../src/feedback.mjs'", `from 'data:text/javascript;base64,${Buffer.from(moduleCode).toString('base64')}'`);
    const output = docker(['-e', `PGDATABASE=${database}`, apiContainer, 'node', '--input-type=module'], fixture);
    assert.match(output, /Feedback PostgreSQL replay, quotas, deduplication and concurrency passed; no email sent/);
  } finally { docker([dbContainer, 'dropdb', '-U', 'postgres', '--force', database]); }
});
