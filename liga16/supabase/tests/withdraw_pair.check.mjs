// Prueba de supabase/pair-withdrawal.sql contra Postgres real en memoria (PGlite). No es parte del build:
//   mkdir /tmp/pgl && cd /tmp/pgl && npm i @electric-sql/pglite && cp <repo>/liga16/supabase/tests/withdraw_pair.check.mjs t.mjs && node t.mjs
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
const db = new PGlite();
await db.exec(`
create schema auth; create table auth.users(id uuid primary key, raw_app_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true),'')::uuid $$;
create type match_status as enum ('scheduled','live','finished','walkover','disputed','cancelled');
create table public.pairs(id uuid primary key default gen_random_uuid(), tournament_id uuid, category_id uuid, name text, seed int, status text not null default 'pending');
create table public.matches(id uuid primary key default gen_random_uuid(), tournament_id uuid, category_name text, round text, status match_status not null default 'scheduled', side_a_pair_id uuid, side_b_pair_id uuid, winner text, sets jsonb, updated_at timestamptz default now());
create role authenticated; create role anon;
create or replace function public.is_admin_or_organizer(allowed_roles text[]) returns boolean as $$ select exists (select 1 from auth.users where id = auth.uid() and raw_app_meta_data->>'role' = any(allowed_roles)); $$ language sql stable security definer set search_path = public, auth;
`);
const sql = fs.readFileSync(new URL("../pair-withdrawal.sql", import.meta.url).pathname,"utf8").replace(/revoke all[^;]*;|grant execute[^;]*;/g,"").replace(/drop function if exists[^;]*;/,"");
await db.exec(sql);
const T="11111111-1111-1111-1111-111111111111", C1="aaaaaaaa-0000-0000-0000-000000000001", C2="aaaaaaaa-0000-0000-0000-000000000002", ADMIN="22222222-2222-2222-2222-222222222222", USER="33333333-3333-3333-3333-333333333333";
await db.exec(`insert into auth.users values ('${ADMIN}','{"role":"admin"}'),('${USER}','{"role":"player"}')`);
const ids = {};
const mkp = async (n,cat=C1,t=T)=>{ ids[n]=(await db.query("insert into pairs(tournament_id,category_id,name,seed,status) values ($1,$2,$3,1,'confirmed') returning id",[t,cat,n])).rows[0].id; };
for (const n of ["A","B","C","D"]) await mkp(n);
await mkp("X",C2); await mkp("Y",C2);
const mk = async (round,a,b,status="scheduled",winner=null,sets=null)=> (await db.query("insert into matches(tournament_id,round,side_a_pair_id,side_b_pair_id,status,winner,sets) values ($1,$2,$3,$4,$5,$6,$7) returning id",[T,round,ids[a],ids[b],status,winner,sets])).rows[0].id;
const as = (u)=>db.exec(`set app.uid='${u}'`);
const st = async(n)=> (await db.query("select status from pairs where id=$1",[ids[n]])).rows[0].status;
const cnt = async()=> (await db.query("select count(*)::int c from matches")).rows[0].c;
let pass=0, fail=0; const ok=(c,msg)=>{console.log((c?"OK  ":"FAIL")+" "+msg); c?pass++:fail++;};
const call = async(n)=>{ try{ return {r:(await db.query("select withdraw_pair($1) as r",[typeof n==="string"&&ids[n]?ids[n]:n])).rows[0].r}; }catch(e){ return {e:e.message}; } };
const reset = async()=>{ await db.exec("delete from matches; update pairs set status='confirmed', seed=1"); };
await as(USER); let r = await call("B"); ok(r.e==="forbidden","jugador sin rol: forbidden"); ok(await st("B")==="confirmed","forbidden no cambia nada");
await as(ADMIN);
r = await call("99999999-9999-9999-9999-999999999999"); ok(r.e==="pair_not_found","pareja inexistente");
// sin llave: solo estado
await mk("Jornada 1 · Suma 9","A","B","finished","a",'[{"a":6,"b":3}]'); await mk("Suma 9 varonil · Grupo A · J1","C","D");
r = await call("B"); ok(r.r?.mode==="status_only"&&r.r.deleted===0,"sin llave: solo estado "+JSON.stringify(r.r)); ok(await cnt()===2,"partidos de grupo intactos (incl. pendiente)");
r = await call("B"); ok(r.e==="already_withdrawn","doble baja rechazada");
// llave generada sin actividad: el servidor deriva el plan completo (el cliente solo manda el id)
await reset();
await mk("Semifinal · r1-m1","A","B"); await mk("Semifinal · r1-m2","C","D"); await mk("Final · r2-m1","A","A"); const other=await mk("Semifinal · r1-m1","X","Y");
await mk("Suma 9 varonil · Grupo A · J1","A","C");
r = await call("B"); ok(r.r?.mode==="rebuild"&&r.r.deleted===3&&r.r.seeds_cleared===4,"llave sin actividad: rebuild, borra 3 cruces de la categoría, libera 4 seeds "+JSON.stringify(r.r));
ok((await db.query("select count(*)::int c from matches where id=$1",[other])).rows[0].c===1,"cruce de OTRA categoría intacto");
ok((await db.query("select seed from pairs where name='X'")).rows[0].seed===1,"seed de otra categoría intacto");
ok((await db.query("select count(*)::int c from matches where round like 'Suma%'")).rows[0].c===1,"partido de grupo intacto");
// llave empezada (carrera: un cruce ya tiene actividad al ejecutar): walkover, no borrado
await reset();
const k1=await mk("Semifinal · r1-m1","A","B"); const k2=await mk("Semifinal · r1-m2","C","D","finished","a",'[{"a":6,"b":2}]');
r = await call("B"); ok(r.r?.mode==="walkover"&&r.r.walkovers===1&&r.r.deleted===0,"llave empezada: walkover, sin borrar "+JSON.stringify(r.r));
let w=(await db.query("select status,winner from matches where id=$1",[k1])).rows[0]; ok(w.status==="walkover"&&w.winner==="a","rival A gana por walkover");
ok((await db.query("select status,winner from matches where id=$1",[k2])).rows[0].status==="finished","cruce jugado intacto");
// pareja en lado b y a: ganador correcto
await reset(); const k3=await mk("Semifinal · r1-m1","B","A"); await mk("Semifinal · r1-m2","C","D","live");
r = await call("B"); w=(await db.query("select winner from matches where id=$1",[k3])).rows[0]; ok(w.winner==="b","B en lado a: gana el lado b");
// cruce sin rival definido no se inventa
await reset(); await mk("Semifinal · r1-m1","C","D","finished","a",'[{"a":6,"b":2}]');
const nullm=(await db.query("insert into matches(tournament_id,round,side_a_pair_id,status) values ($1,'Final · r2-m1',$2,'scheduled') returning id",[T,ids.B])).rows[0].id;
r = await call("B"); ok(r.r?.mode==="walkover"&&r.r.walkovers===0,"sin rival definido: 0 walkovers (no inventa)"); ok((await db.query("select status from matches where id=$1",[nullm])).rows[0].status==="scheduled","cruce sin rival intacto");
ok(await st("B")==="withdrawn","baja registrada");
// atomicidad: si algo falla a mitad, nada cambia (forzado con trigger que lanza al marcar withdrawn)
await reset();
await db.exec(`create function boom() returns trigger language plpgsql as $$ begin if new.status='withdrawn' then raise exception 'boom'; end if; return new; end $$; create trigger t_boom before update on pairs for each row execute function boom();`);
await mk("Semifinal · r1-m1","A","B"); await mk("Semifinal · r1-m2","C","D");
r = await call("B"); ok(r.e==="boom","fallo en el último paso (trigger)");
ok(await cnt()===2,"ATOMICIDAD: los cruces borrados se restauraron"); ok((await db.query("select count(*)::int c from pairs where seed is null")).rows[0].c===0,"ATOMICIDAD: siembra intacta"); ok(await st("B")==="confirmed","ATOMICIDAD: B sin baja");
await db.exec("drop trigger t_boom on pairs");
await reset(); await mk("Semifinal · r1-m1","A","B"); await mk("Semifinal · r1-m2","C","D","finished","a",'[{"a":6,"b":2}]'); await db.exec("create trigger t_boom before update on pairs for each row execute function boom();");
r = await call("B"); ok(r.e==="boom","fallo tras el walkover");
ok((await db.query("select count(*)::int c from matches where status='walkover'")).rows[0].c===0,"ATOMICIDAD: el walkover se revirtió");
console.log(`${pass} ok, ${fail} fallan`); process.exit(fail?1:0);
