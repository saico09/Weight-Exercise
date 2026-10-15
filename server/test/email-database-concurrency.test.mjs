import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('real PostgreSQL unsubscribe/reactivation race (no SMTP)',{skip:process.env.RUN_CLOUD_DB_TESTS!=='1'},()=>{
  const code=readFileSync(new URL('./fixtures/email-concurrency.mjs',import.meta.url),'utf8');
  const output=execFileSync('docker',['compose','--env-file','.env.local','exec','-T','api','node','--input-type=module'],{cwd:fileURLToPath(new URL('../../',import.meta.url)),input:code,encoding:'utf8'});
  assert.match(output,/regression passed; no email sent/);
});
