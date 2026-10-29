// Run from a temporary test directory with @electric-sql/pglite installed.
// Copy this file beside node_modules and set LIGA16_ROOT to the checkout directory.
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();
const root=process.env.LIGA16_ROOT ?? new URL('../../', import.meta.url).pathname;
await db.exec(`
create role authenticated;create schema storage;create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant all on storage.objects to authenticated;create policy old_storage on storage.objects for all to authenticated using(true) with check(true);
create schema auth; create role anon;
create table auth.users(id uuid primary key,raw_app_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
create table tournaments(id uuid primary key default gen_random_uuid(),organizer_id uuid references auth.users, status text default 'draft',club_id uuid);
create table tournament_categories(id uuid primary key default gen_random_uuid(),tournament_id uuid references tournaments);
create table pairs(id uuid primary key default gen_random_uuid(),tournament_id uuid references tournaments,category_id uuid references tournament_categories);
create table matches(id uuid primary key default gen_random_uuid(),tournament_id uuid references tournaments,side_a_pair_id uuid references pairs,side_b_pair_id uuid references pairs);
create table registrations(id uuid primary key default gen_random_uuid(),tournament_id uuid references tournaments,category_id uuid references tournament_categories,pair_id uuid references pairs,user_id uuid references auth.users);
`);
const globals=['clubs','courts','player_profiles','player_cards','teams','leagues','league_divisions','league_teams','news','sponsors','invitations','ranking_events'];
for(const t of globals) await db.exec(`create table ${t}(id uuid primary key default gen_random_uuid()${t==='courts'?',club_id uuid references clubs(id)':t==='player_profiles'?",display_name text,username text,city text,state text,country text,role text,is_public boolean,status text":''})`);
const tables=['tournaments','tournament_categories','pairs','matches','registrations',...globals];
// Role-only permissive baseline reproduces the broad organizer grant from the repo.
// Restrictive policies must intersect rather than merely add another OR policy.
await db.exec(`create function public.baseline_manager() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from auth.users where id=auth.uid() and raw_app_meta_data->>'role' in ('admin','organizer'))$$;`);
for(const t of tables) await db.exec(`alter table ${t} enable row level security; grant all on ${t} to authenticated; create policy old_broad on ${t} for all to authenticated using(public.baseline_manager()) with check(public.baseline_manager());`);
const ids=Object.fromEntries(['admin','a','b','player','ta','tb','legacy','ca','cb','pa','pb','ra','rb','ma','mb'].map((x,i)=>[x,`00000000-0000-0000-0000-${(i+1).toString().padStart(12,'0')}`]));
for(const u of ['admin','a','b','player']) await db.query('insert into auth.users values($1,$2)',[ids[u],{role:u==='a'||u==='b'?'organizer':u}]);
await db.exec(`insert into tournaments(id,organizer_id,status) values('${ids.ta}','${ids.a}','published'),('${ids.tb}','${ids.b}','published'),('${ids.legacy}',null,'published'); insert into tournament_categories values('${ids.ca}','${ids.ta}'),('${ids.cb}','${ids.tb}'); insert into pairs values('${ids.pa}','${ids.ta}','${ids.ca}'),('${ids.pb}','${ids.tb}','${ids.cb}'); insert into registrations values('${ids.ra}','${ids.ta}','${ids.ca}','${ids.pa}','${ids.player}'),('${ids.rb}','${ids.tb}','${ids.cb}','${ids.pb}','${ids.player}'); insert into matches values('${ids.ma}','${ids.ta}','${ids.pa}',null),('${ids.mb}','${ids.tb}','${ids.pb}',null);`);
const sql=fs.readFileSync(`${root}/supabase/review/organizer-isolation.sql`,'utf8').replace(/ROLLBACK;[^\n]*$/m,'COMMIT;');
await db.exec(sql);
await db.exec(sql); // Reapplication must preserve rows and policy shape.
if(process.env.LIGA16_BREAK_ISOLATION==='1') await db.exec('drop policy organizer_tournament_update on tournaments;drop policy organizer_owner_write on tournaments');
// Keep a legacy row in every global catalog, so forbidden UPDATE/DELETE cannot pass on zero rows.
for(const t of globals) await db.exec(`insert into ${t}(id) values('22222222-0000-0000-0000-000000000001')`);
for(const t of ['tournaments','tournament_categories','pairs','matches']) {
 await db.exec(`grant select on ${t} to anon;create policy fixture_public_read on ${t} for select to anon,authenticated using(${t==='tournaments'?"status<>'draft'":'true'});`);
}
await db.exec(`insert into tournaments(id,organizer_id,status) values('11111111-0000-0000-0000-000000000001','${ids.b}','draft');insert into pairs(id,tournament_id) values('11111111-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000001');`);
let n=0;
const ok=(condition,message)=>{assert.ok(condition,message); console.log('OK '+message);n++};
const as=async u=>db.exec(`reset role;set request.uid='${ids[u]}';set role authenticated`);
const denied=async(sql,message)=>{let error;try{await db.exec(sql)}catch(e){error=e}ok(!!error,message)};
await as('a');
await db.exec(`insert into storage.objects(bucket_id,name) values('team-crests','tournaments/${ids.ta}/ok.png')`);
await denied(`insert into storage.objects(bucket_id,name) values('team-crests','tournaments/${ids.tb}/bad.png')`,'Storage rejects B path');
await denied(`insert into storage.objects(bucket_id,name) values('team-crests','old-slug/bad.png')`,'Storage rejects legacy global path');
await denied(`insert into storage.objects(bucket_id,name) values('other-bucket','tournaments/${ids.ta}/bad.png')`,'Storage rejects unrelated bucket');
await denied(`insert into storage.objects(bucket_id,name) values('team-crests','tournaments/not-a-uuid/bad.png')`,'Storage rejects invalid UUID');
await denied(`update storage.objects set name='tournaments/${ids.tb}/moved.png'`,'Storage rejects move into B');

ok((await db.query(`insert into tournaments default values returning organizer_id`)).rows[0].organizer_id===ids.a,'owner set by DB');
await denied(`insert into tournaments(organizer_id) values('${ids.b}')`,'cannot create owned by B');
await denied(`update tournaments set organizer_id='${ids.b}' where id='${ids.ta}'`,'cannot transfer owner');
for(const [table,id] of [['tournaments','tb'],['tournaments','legacy'],['tournament_categories','cb'],['pairs','pb'],['matches','mb'],['registrations','rb']]){
 ok((await db.query(`delete from ${table} where id='${ids[id]}' returning id`)).rows.length===0,`A cannot delete ${table} ${id}`);
 ok((await db.query(`update ${table} set id=id where id='${ids[id]}' returning id`)).rows.length===0,`A cannot update ${table} ${id}`);
}
for(const table of ['tournament_categories','pairs','matches','registrations']){
 await denied(`insert into ${table}(tournament_id) values('${ids.tb}')`,`cannot insert into B ${table} without returning`);
}
await denied(`insert into pairs(tournament_id,category_id) values('${ids.ta}','${ids.cb}')`,'cross-category rejected');
await denied(`insert into matches(tournament_id,side_a_pair_id) values('${ids.ta}','${ids.pb}')`,'cross-match A rejected');
await denied(`insert into matches(tournament_id,side_b_pair_id) values('${ids.ta}','${ids.pb}')`,'cross-match B rejected');
await denied(`insert into registrations(tournament_id,pair_id) values('${ids.ta}','${ids.pb}')`,'cross-registration rejected');
await denied(`update pairs set tournament_id='${ids.tb}',category_id='${ids.cb}' where id='${ids.pa}'`,'relocation rejected');
ok((await db.query('select id from registrations')).rows.length===1,'only own payments readable');
await denied(`select organizer_player('${ids.tb}','Nombre Falso')`,'scoped player RPC rejects B');
const prof=(await db.query(`select * from organizer_player('${ids.ta}','Jugador de Prueba')`)).rows[0];
ok(prof.role==='player' && prof.status==='pendiente','scoped player RPC creates pending player, not verified or privileged');
ok((await db.query(`select * from organizer_player('${ids.ta}','Jugador de Prueba')`)).rows[0].id===prof.id,'RPC reuses existing public profile');
for(const t of globals) {
 ok((await db.query(`update ${t} set id=id where id='22222222-0000-0000-0000-000000000001' returning id`)).rows.length===0,`cannot update legacy ${t}`);
 ok((await db.query(`delete from ${t} where id='22222222-0000-0000-0000-000000000001' returning id`)).rows.length===0,`cannot delete legacy ${t}`);
}
for(const t of globals.filter(t=>t!=='clubs')) await denied(`insert into ${t} default values`,`no global insert ${t}`);
const ownClub=(await db.query('insert into clubs default values returning id,created_by')).rows[0];
ok(ownClub.created_by===ids.a,'new club owner is fixed by DB');
await db.exec(`insert into courts(club_id) values('${ownClub.id}')`);
await denied(`insert into clubs(created_by) values('${ids.b}')`,'cannot spoof club owner');
await denied(`update clubs set created_by='${ids.b}' where id='${ownClub.id}'`,'cannot transfer club ownership');
await as('b');
ok((await db.query(`update clubs set id=id where id='${ownClub.id}' returning id`)).rows.length===0,'B cannot edit A club');
await denied(`insert into courts(club_id) values('${ownClub.id}')`,'B cannot add court in A club');
await denied(`insert into tournaments(club_id) values('${ownClub.id}')`,'B cannot attach A-owned venue');
ok((await db.query(`delete from courts where club_id='${ownClub.id}' returning id`)).rows.length===0,'B cannot delete A court');
ok((await db.query('select id from registrations')).rows[0].id===ids.rb,'B sees own payments');
ok((await db.query(`update pairs set id=id where id='${ids.pa}' returning id`)).rows.length===0,'B cannot update A');
await as('admin');ok((await db.query('update tournaments set id=id returning id')).rows.length===5,'admin manages all including legacy NULL');
for(const t of globals) await db.exec(`insert into ${t} default values`);
ok(true,'admin retains global catalog writes');
await db.exec(`reset role;update auth.users set raw_app_meta_data='{"role":"player"}' where id='${ids.a}';`);
await as('a');
ok((await db.query(`update tournaments set id=id where id='${ids.ta}' returning id`)).rows.length===0,'revoked organizer cannot update even with stale client role');
await denied(`insert into tournaments default values`,'revoked organizer cannot create');
await denied(`select organizer_player('${ids.ta}','Otro Jugador')`,'revoked organizer RPC rejects');
await db.exec(`reset role;set request.uid='';set role anon;`);
ok((await db.query('select * from tournaments')).rows.every(r=>r.status!=='draft'),'anon sees no draft');
ok(!(await db.query('select * from pairs')).rows.some(r=>r.id==='11111111-0000-0000-0000-000000000002'),'anon sees no draft dependencies');
console.log(`${n} assertions passed. PGlite RLS fixture, not PostgREST/production verification.`);
await db.close();
