// Copy next to temporary PGlite node_modules, set LIGA16_ROOT to this checkout.
import {PGlite} from '@electric-sql/pglite';import fs from 'node:fs';
const db=new PGlite();const root=process.env.LIGA16_ROOT ?? new URL('../../', import.meta.url).pathname;
await db.exec(`create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb$$;grant usage on schema auth to authenticated,anon;grant execute on all functions in schema auth to authenticated,anon;create schema storage;create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant all on storage.objects to authenticated;`);
let schema=fs.readFileSync(root+'/supabase/schema.sql','utf8');
// Repository schema has legacy SQL array literal syntax: normalize only that
// bootstrap typo in the fixture, not the ownership proposal under test.
schema=schema.replace('create extension if not exists "pgcrypto";','').replace(/is_admin_or_organizer\(\[/g,'is_admin_or_organizer(ARRAY[');
await db.exec(schema);
for(const path of ['fix-player-profiles.sql','migrate-scoring-courts.sql','self-registration.sql','player-name-unique.sql','pair-withdrawal.sql']) {
 try{await db.exec(fs.readFileSync(root+'/supabase/'+path,'utf8'));console.log('loaded',path)}catch(e){console.log('FAIL loading',path,e.message);throw e}
}
await db.exec('grant all on all tables in schema public to authenticated;grant select on all tables in schema public to anon;');
const sql=fs.readFileSync(root+'/supabase/review/organizer-isolation.sql','utf8').replace(/ROLLBACK;[^\n]*$/m,'COMMIT;');await db.exec(sql);await db.exec(sql);
console.log('Full repository schema + migrations + isolation loaded twice');
await db.exec(`insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values('00000000-0000-0000-0000-000000000001','testa@example.invalid','{"role":"organizer"}','{}'),('00000000-0000-0000-0000-000000000002','testb@example.invalid','{"role":"organizer"}','{}');set request.uid='00000000-0000-0000-0000-000000000001';set role authenticated;`);
const t=(await db.query(`insert into tournaments(slug,name,start_date,end_date,registration_deadline) values('fixture-a','Fixture A','2026-10-28','2026-10-30','2026-10-28') returning id,organizer_id`)).rows[0];
console.log('created owned tournament',t);
const p=(await db.query('select * from organizer_player($1,$2)',[t.id,'Jugador Fixture Completo'])).rows[0];
console.log('scoped player', {id:p.id,role:p.role,status:p.status});
if(p.status!=='pendiente'||p.role!=='player') throw Error('unsafe profile defaults');
console.log('player card count',(await db.query('select count(*) from player_cards where player_id=$1',[p.id])).rows[0]);
const category=(await db.query(`insert into tournament_categories(tournament_id,name,sex) values($1,'4ta Varonil','M') returning id`,[t.id])).rows[0];
const pair=(await db.query(`insert into pairs(tournament_id,category_id,name,player1_id) values($1,$2,'Fixture Pareja',$3) returning id`,[t.id,category.id,p.id])).rows[0];
await db.exec(`reset role;set request.uid='00000000-0000-0000-0000-000000000002';set role authenticated;`);
let denied=false;try{await db.query('select withdraw_pair($1)',[pair.id])}catch{denied=true}
if(!denied) throw Error('B withdrew A pair');
console.log('Cross-owner withdrawal RPC rejected under full schema');
await db.exec(`reset role;set request.uid='00000000-0000-0000-0000-000000000001';set role authenticated;`);
console.log('Owner withdrawal', (await db.query('select withdraw_pair($1) result',[pair.id])).rows[0]);

await db.exec('reset role;');
const entriesSQL=fs.readFileSync(root+'/supabase/review/individual-entries.sql','utf8').replace(/ROLLBACK;[^\n]*$/m,'COMMIT;');
await db.exec(entriesSQL);await db.exec(entriesSQL);
await db.exec(`set request.uid='00000000-0000-0000-0000-000000000001';set role authenticated;`);
const entry=(await db.query('insert into tournament_entries(tournament_id,player_id) values($1,$2) returning id',[t.id,p.id])).rows[0];
const payment=(await db.query('select * from entry_payments where entry_id=$1',[entry.id])).rows[0];
if(payment.status!=='payment_pending'||payment.amount_cents!==null) throw Error('payment invented');
let duplicateDenied=false;try{await db.query('insert into tournament_entries(tournament_id,player_id) values($1,$2)',[t.id,p.id])}catch{duplicateDenied=true}
if(!duplicateDenied)throw Error('duplicate entry allowed');
console.log('Unique individual entry; no amount or paid status invented');
await db.exec(`reset role;set request.uid='00000000-0000-0000-0000-000000000002';set role authenticated;`);
if((await db.query('select * from entry_payments where entry_id=$1',[entry.id])).rows.length)throw Error('B reads A payment');
let bDenied=false;try{await db.query("select record_entry_payment($1,0,gen_random_uuid(),'paid','cash',1)",[entry.id])}catch{bDenied=true}if(!bDenied)throw Error('B edits A payment');
console.log('B cannot read/edit A individual payment');
await db.exec(`reset role;set request.uid='00000000-0000-0000-0000-000000000001';set role authenticated;`);
await db.query("select record_entry_payment($1,0,gen_random_uuid(),'paid','cash',50000)",[entry.id]);
const revised=(await db.query('select revision from entry_payments where entry_id=$1',[entry.id])).rows[0];
if(revised.revision!==1)throw Error('revision not incremented');
console.log('Owner can record payment; revision incremented; sports level untouched');

await db.exec(`reset role;insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values('00000000-0000-0000-0000-000000000003','self@example.invalid','{"role":"player"}','{}');`);
const self=(await db.query("select id from player_profiles where user_id='00000000-0000-0000-0000-000000000003'")).rows[0];
await db.query("update tournaments set status='registration_open' where id=$1",[t.id]);
await db.exec(`set request.uid='00000000-0000-0000-0000-000000000003';set role authenticated;`);
const selfEntry=(await db.query('insert into tournament_entries(tournament_id,player_id) values($1,$2) returning id',[t.id,self.id])).rows[0];
if((await db.query('select * from entry_payments')).rows.length!==1)throw Error('self reads someone else payment');
let selfDenied=false;try{await db.query("select record_entry_payment($1,0,gen_random_uuid(),'paid','cash',1)",[selfEntry.id])}catch{selfDenied=true}if(!selfDenied)throw Error('self marks paid');
let spoofDenied=false;try{await db.query('insert into tournament_entries(tournament_id,player_id) values($1,$2)',[t.id,p.id])}catch{spoofDenied=true}
if(!spoofDenied)throw Error('self enters another player');
console.log('Self sees only own payment; cannot mark paid or enroll another player');
await db.exec(`reset role;set request.uid='00000000-0000-0000-0000-000000000001';set role authenticated;`);
let reassignmentDenied=false;try{await db.query('update entry_payments set entry_id=$1 where entry_id=$2',[selfEntry.id,entry.id])}catch{reassignmentDenied=true}
if(!reassignmentDenied)throw Error('payment reassignment allowed');
await db.query("select record_entry_payment($1,1,gen_random_uuid(),'paid','cash',55000)",[entry.id]);
let staleDenied=false;try{await db.query("select record_entry_payment($1,1,gen_random_uuid(),'paid','cash',1)",[entry.id])}catch{staleDenied=true}if(!staleDenied)throw Error('stale revision write allowed');
console.log('Direct payment writes denied; required revision rejects stale RPC');
await db.exec('reset role;');
if((await db.query('select count(*)::int n from private.entry_payment_audit where entry_id=$1',[entry.id])).rows[0].n!==2)throw Error('audit missing');
console.log('Two monetary edits preserved in private audit, failed edits add nothing');
await db.exec(`set request.uid='00000000-0000-0000-0000-000000000003';set role authenticated;`);
const existingEntry=(await db.query('select (enter_my_tournament($1)).id id',[t.id])).rows[0];
if(existingEntry.id!==selfEntry.id)throw Error('self entry duplicate on retry');
console.log('Individual signup RPC returns existing entry without another payment or fixed partner');
await db.exec('reset role;');await db.query("update tournaments set status='finished' where id=$1",[t.id]);
await db.exec(`set request.uid='00000000-0000-0000-0000-000000000003';set role authenticated;`);
let closedDenied=false;try{await db.query('select enter_my_tournament($1)',[t.id])}catch{closedDenied=true}if(!closedDenied)throw Error('closed registration accepted');
console.log('Closed tournament cannot receive public signup');
await db.close();
