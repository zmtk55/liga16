import {PGlite} from '@electric-sql/pglite';import fs from 'node:fs';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
const root=new URL('../../',import.meta.url).pathname;const fixture=new URL('./',import.meta.url).pathname;process.chdir(root);const db=new PGlite();
const uid='00000000-0000-0000-0000-000000000003',pid='00000000-0000-0000-0000-000000000004';
await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;create table auth.users(id uuid primary key);create table tournaments(id uuid primary key,status text);create table player_profiles(id uuid primary key,user_id uuid,display_name text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;create function private.liga16_role() returns text language sql stable as $$select 'player'::text$$;create function private.manages_tournament(tid uuid) returns boolean language sql stable as $$select false$$;grant usage on schema auth,private to authenticated;grant execute on all functions in schema auth,private to authenticated;grant select on tournaments,player_profiles to authenticated;insert into auth.users values('${uid}');insert into player_profiles values('${pid}','${uid}','Ana Silva');insert into tournaments values('00000000-0000-0000-0000-000000000010','registration_open'),('00000000-0000-0000-0000-000000000011','registration_open');`);
await db.exec(`create table public.pairs(id uuid primary key,tournament_id uuid,category_id uuid,name text,player1_id uuid,player2_id uuid,crest_url text,seed integer,status text);create function public.organizer_player(tid uuid,player_name text) returns setof player_profiles language sql as $$select * from player_profiles where false$$;`);
await db.exec(fs.readFileSync(root+'/supabase/review/individual-entries.sql','utf8').replace(/ROLLBACK;[^\n]*$/m,'COMMIT;'));
let chain=Promise.resolve();
const service={name:'isolated-postgres-entry',configureServer(server){server.middlewares.use('/__fixture/entry',(req,res)=>{chain=chain.then(async()=>{
 try{
 const id=new URL(req.url,'http://fixture.invalid').searchParams.get('tournament');
 const tid=id==='t1'?'00000000-0000-0000-0000-000000000010':id==='t2'?'00000000-0000-0000-0000-000000000011':null;
 if(!tid)throw Error('Unknown synthetic tournament');
 await db.exec(`set request.uid='${uid}';set role authenticated;`);
 if(req.method==='POST')await db.query('select enter_my_tournament($1)',[tid]);
 const rows=(await db.query('select id from tournament_entries where tournament_id=$1 and player_id=$2',[tid,pid])).rows;
 res.setHeader('content-type','application/json');res.end(JSON.stringify({playerName:'Ana Silva',entered:rows.length===1,amountCents:75000,currency:'MXN',simulated:true}));
 }catch(e){res.statusCode=400;res.end(JSON.stringify({error:e.message}));}finally{await db.exec('reset role;');}
 });});}};
const server=await createServer({configFile:false,root,plugins:[react(),service],resolve:{alias:[{find:/^\.\/index$/,replacement:fixture+'data.ts'},{find:/^@\/lib\/data$/,replacement:fixture+'data.ts'},{find:'@/contexts/AuthContext',replacement:fixture+'auth.tsx'},{find:'@/lib/tournament-entry-service',replacement:fixture+'service.ts'},{find:'@/lib/entry-payment-service',replacement:fixture+'payments.ts'},{find:'@',replacement:root+'/src'}]},server:{host:'127.0.0.1',port:3104,fs:{allow:['/tmp']}}});await server.listen();console.log('FIXTURE_READY');
async function close(){await server.close();await db.close();process.exit(0)}process.on('SIGTERM',close);process.on('SIGINT',close);
