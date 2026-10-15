import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const enabled = process.env.RUN_CLOUD_INTEGRATION === '1';
const base = 'http://127.0.0.1:3001'; const mailbox = 'http://127.0.0.1:8025';
const root = fileURLToPath(new URL('../../', import.meta.url));
const prefix = `emailqa_${Date.now().toString(36)}`;
async function api(path, method = 'GET', data, account, owner = account?.id) {
  const res = await fetch(base + '/api' + path, { method, headers: { Origin: 'http://127.0.0.1:5173', ...(data ? { 'Content-Type': 'application/json' } : {}), ...(account?.cookie ? { Cookie: account.cookie } : {}), ...(owner ? { 'X-WE-Account': owner } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
  return { status: res.status, data: await res.json(), cookie: res.headers.get('set-cookie')?.split(';')[0] };
}
const sql = query => execFileSync('docker', ['compose','--env-file','.env.local','exec','-T','db','psql','-U','postgres','-d','weight_exercise','-At','-c',query], { cwd: root, encoding: 'utf8' }).trim();
const tick = () => execFileSync('docker', ['compose','--env-file','.env.local','exec','-T','api','node','src/run-summary-once.mjs'], { cwd: root, encoding: 'utf8' });
async function messages(address, subject) {
  const data = await (await fetch(mailbox + '/api/v1/messages')).json();
  return data.messages.filter(message => message.To.some(to => to.Address === address) && message.Subject.includes(subject));
}
async function deliveredMessages(address, count) {
  for (let attempt=0;attempt<60;attempt++) {
    const found=await messages(address,'resumen de progreso');
    if (found.length>=count) return found;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  return messages(address,'resumen de progreso');
}
async function createAccount(suffix) {
  const address = `${prefix}_${suffix}@example.test`;
  assert.equal((await api('/auth/request-code','POST',{email:address})).status,200);
  const message = (await messages(address,'Código de acceso'))[0]; assert.ok(message);
  const full = await (await fetch(mailbox + '/api/v1/message/' + message.ID)).json();
  const code = full.Text.match(/Tu código es: (\d{6})/)[1];
  const login = await api('/auth/verify-code','POST',{email:address,code,username:`${prefix}_${suffix}`});
  assert.equal(login.status,200);
  return { id: login.data.user.id, cookie: login.cookie, email: address };
}
const optIn = { enabled:true,consent:true,cadence:'weekly',timezone:'America/Santiago',time:'09:00',weekday:1,monthDay:1 };
const sample = () => ({version:1,profile:{heightCm:170,initialWeightKg:80,goalWeightKg:75,age:30,initialDate:'2026-10-01'},settings:{theme:'aurora',language:'es',weightUnit:'kg',heightUnit:'cm',chartStyle:'bars'},records:[{id:'r1',date:'2026-10-01',weightKg:80,exercise:false,healthy:true,note:'',steps:0},{id:'r2',date:'2026-10-14',weightKg:79,exercise:true,healthy:true,note:'=NOT_A_FORMULA',steps:8000}],initialRecordId:'r1',lastPromptDate:null,celebratedAchievementIds:[]});

test('opt-in email scheduler, private XLSX attachment and unsubscribe', {skip:!enabled}, async t => {
  assert.equal((await api('/health')).data.mailMode,'mailpit','This test refuses real email delivery.');
  const accounts=[];
  t.after(async()=>{ for(const account of accounts) { await api('/account','DELETE',{confirmation:'DELETE'},account); sql(`DELETE FROM users WHERE id='${account.id}' AND email LIKE 'emailqa_%@example.test'`); } });
  const a=await createAccount('a'); accounts.push(a);
  const b=await createAccount('b'); accounts.push(b);
  await t.test('disabled by default; opt-in requires backup, consent and owner identity',async()=>{
    assert.equal((await api('/email-summary','GET',null,a)).data.enabled,false);
    assert.equal((await api('/email-summary','PUT',optIn,a)).data.error.code,'backup_required');
    assert.equal((await api('/backup','PUT',{revision:0,data:sample()},a)).status,200);
    const restored=(await api('/backup','GET',null,a)).data.data;
    assert.equal(restored.records[0].steps,0);assert.equal(restored.records[1].steps,8000);assert.equal(restored.settings.chartStyle,'bars');
    assert.equal((await api('/email-summary','PUT',{...optIn,consent:false},a)).status,400);
    assert.equal((await api('/email-summary','PUT',optIn,b,a.id)).status,409);
    const saved=await api('/email-summary','PUT',optIn,a);assert.equal(saved.status,200);assert.equal(saved.data.enabled,true);
    assert.equal(saved.data.recordCount,2);assert.ok(new Date(saved.data.nextSendAt)>new Date());
    assert.equal((await api('/email-summary','GET',null,b)).data.enabled,false);
  });
  let unsubscribe;
  await t.test('due job sends once with complete XLSX; durable tick is idempotent',async()=>{
    sql(`UPDATE email_preferences SET next_send_at=now()-interval '1 minute' WHERE user_id='${a.id}'`);
    tick(); tick();
    const delivered=await deliveredMessages(a.email,1);assert.equal(delivered.length,1);
    const full=await(await fetch(mailbox+'/api/v1/message/'+delivered[0].ID)).json();
    assert.equal(full.Attachments.length,1);assert.match(full.Attachments[0].FileName,/\.xlsx$/);
    assert.equal(full.Attachments[0].ContentType,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const content=await(await fetch(mailbox+'/api/v1/message/'+delivered[0].ID+'/part/'+full.Attachments[0].PartID)).arrayBuffer();
    assert.equal(new Uint8Array(content)[0],0x50);assert.equal(new Uint8Array(content)[1],0x4b);
    const zip=Buffer.from(content);let offset=0;const xml=[];
    while(zip.readUInt32LE(offset)===0x04034b50){const length=zip.readUInt32LE(offset+18),start=offset+30+zip.readUInt16LE(offset+26);xml.push(inflateRawSync(zip.subarray(start,start+length)).toString());offset=start+length;}
    assert.ok(xml.join('').includes('8000'));assert.ok(xml.join('').includes('=NOT_A_FORMULA'));
    unsubscribe=new URL(full.Text.match(/http:\/\/127\.0\.0\.1:5173\/api\/email-summary\/unsubscribe\?token=[a-zA-Z0-9.%_-]+/)[0]);
    assert.equal(sql(`SELECT count(*) FROM email_deliveries WHERE user_id='${a.id}' AND status='sent'`),'1');
    assert.ok((await api('/email-summary','GET',null,a)).data.lastSentAt);
  });
  await t.test('GET unsubscribe is confirmation only; POST disables; old token cannot disable a new opt-in',async()=>{
    const link=base+unsubscribe.pathname+unsubscribe.search;
    assert.equal((await fetch(link)).status,200);
    assert.equal((await api('/email-summary','GET',null,a)).data.enabled,true);
    assert.equal((await fetch(link,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'List-Unsubscribe=One-Click'})).status,200);
    assert.equal((await api('/email-summary','GET',null,a)).data.enabled,false);
    assert.equal((await api('/email-summary','PUT',optIn,a)).status,200);
    assert.equal((await fetch(link,{method:'POST'})).status,404);
    assert.equal((await api('/email-summary','GET',null,a)).data.enabled,true);
  });
  await t.test('expired worker lease resumes queued delivery after a restart',async()=>{
    sql(`INSERT INTO email_deliveries(id,user_id,scheduled_for,status,attempts,next_attempt_at,locked_until) VALUES(gen_random_uuid(),'${a.id}',now()-interval '2 minutes','sending',1,now()-interval '1 minute',now()-interval '1 minute')`);
    tick();
    assert.equal(sql(`SELECT count(*) FROM email_deliveries WHERE user_id='${a.id}' AND status='sent' AND attempts=2`),'1');
    assert.equal((await deliveredMessages(a.email,2)).length,2);
    await api('/email-summary','PUT',{enabled:false},a);
    assert.equal(sql(`SELECT count(*) FROM email_preferences WHERE user_id='${a.id}' AND enabled`),'0');
  });
});
