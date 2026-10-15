import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createSummaryService, unsubscribeToken } from './src/email-summary.mjs';

// Runs through stdin inside the API container. This fixture never creates a mailer,
// never calls runOnce/send, and uses only its own temporary account with a future date.
const pool = new pg.Pool({max:3});
const id=randomUUID(),oldVersion=randomUUID(),newVersion=randomUUID();
let blocker,removal;
async function transaction(fn){const client=await pool.connect();try{await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
try{
  await pool.query('INSERT INTO users(id,email,username) VALUES($1,$2,$3)',[id,`concurrency_${id}@example.test`,`test_${id.slice(0,12)}`]);
  await pool.query("INSERT INTO email_preferences(user_id,enabled,next_send_at,unsubscribe_version) VALUES($1,true,'2099-01-01',$2)",[id,oldVersion]);
  const service=createSummaryService({pool,transaction,mailer:{mode:'mailpit',send(){throw new Error('Fixture must never send mail.');}},secret:process.env.AUTH_SECRET,appUrl:'http://127.0.0.1:5173'});
  blocker=await pool.connect();
  await blocker.query('BEGIN');
  await blocker.query('SELECT id FROM users WHERE id=$1 FOR NO KEY UPDATE',[id]);
  await blocker.query('UPDATE email_preferences SET unsubscribe_version=$2 WHERE user_id=$1',[id,newVersion]);
  let resolved=false;
  removal=service.unsubscribe(unsubscribeToken(process.env.AUTH_SECRET,id,oldVersion),true).then(result=>{resolved=true;return result;});
  await new Promise(resolve=>setTimeout(resolve,100));
  assert.equal(resolved,false,'Unsubscribe must wait for the in-progress account update.');
  await blocker.query('COMMIT');
  assert.equal(await removal,false,'An old token must not unsubscribe the newly enabled version.');
  assert.equal((await pool.query('SELECT enabled FROM email_preferences WHERE user_id=$1',[id])).rows[0].enabled,true);
  console.log('Concurrent unsubscribe/reactivation regression passed; no email sent.');
}finally{
  if(blocker){await blocker.query('ROLLBACK').catch(()=>{});blocker.release();}
  if(removal)await removal.catch(()=>{});
  await pool.query('DELETE FROM users WHERE id=$1',[id]);await pool.end();
}
