import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
const prefix = `load_${Date.now().toString(36)}`;
const accounts = [];
async function api(path, data, cookie, method = data ? 'POST' : 'GET') {
  const res = await fetch('http://127.0.0.1:3001/api' + path, { method, headers: { Origin: 'http://127.0.0.1:5173', ...(data ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
  if (!res.ok) throw new Error(`Local load request failed: ${path} (${res.status})`);
  return { value: await res.json(), cookie: res.headers.get('set-cookie')?.split(';')[0] };
}
const stats = async label => {
  const result = await run('docker', ['stats', '--no-stream', '--format', '{{.Name}}: {{.MemUsage}} | {{.CPUPerc}}', 'weight-exercise-local-db-1', 'weight-exercise-local-api-1', 'weight-exercise-local-mailpit-1']);
  console.log(label + '\n' + result.stdout.trim());
};
try {
  await stats('Before five-user local test');
  for (let i = 0; i < 5; i++) {
    const email = `${prefix}_${i}@example.test`;
    await api('/auth/request-code', { email });
    const inbox = await (await fetch('http://127.0.0.1:8025/api/v1/messages')).json();
    const message = inbox.messages.find(m => m.To.some(to => to.Address === email));
    const full = await (await fetch('http://127.0.0.1:8025/api/v1/message/' + message.ID)).json();
    const code = full.Text.match(/Tu código es: (\d{6})/)[1];
    const auth = await api('/auth/verify-code', { email, code, username: `${prefix}_${i}` });
    accounts.push(auth.cookie);
  }
  const start = Date.now();
  const requests = accounts.map(async cookie => {
    const records = Array.from({ length: 730 }, (_, i) => ({ id: `r${i}`, date: new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10), weightKg: 80 - i / 100, exercise: i % 2 === 0, healthy: i % 3 === 0, note: 'Synthetic local load test' }));
    const data = { version: 1, profile: { heightCm: 170, initialWeightKg: 80, goalWeightKg: 70, age: 30, initialDate: '2024-01-01' }, settings: { theme: 'dark', language: 'es', weightUnit: 'kg', heightUnit: 'cm', motivation: { message: 'Test', image: 'data:image/jpeg;base64,' + 'A'.repeat(200000) } }, records, initialRecordId: 'r0', lastPromptDate: null, celebratedAchievementIds: [] };
    for (let revision = 0; revision < 4; revision++) await api('/backup', { revision, data }, cookie, 'PUT');
    for (let n = 0; n < 20; n++) await api('/backup', null, cookie);
  });
  await Promise.all([...requests, stats('During five-user local test')]);
  console.log(`Completed 20 transactional backups and 100 reads, five accounts with 730 records and 200 KB photo each, in ${Date.now() - start} ms.`);
  await stats('After load');
} finally {
  for (const cookie of accounts) await api('/account', { confirmation: 'DELETE' }, cookie, 'DELETE').catch(() => {});
}
