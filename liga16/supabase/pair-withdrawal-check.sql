-- Comprobación previa (SOLO LECTURA) antes de instalar pair-withdrawal.sql.
-- Ejecutar en el editor SQL de Supabase. No modifica nada.

-- 1) pairs.status existe y es text; sin CHECK que rechace 'withdrawn'.
select column_name, data_type, column_default
  from information_schema.columns where table_schema = 'public' and table_name = 'pairs' and column_name in ('status', 'seed', 'tournament_id');
select conname, pg_get_constraintdef(oid) as definicion
  from pg_constraint where conrelid = 'public.pairs'::regclass and contype = 'c';

-- 2) matches: columnas usadas y valores del enum match_status (debe incluir 'walkover').
select column_name, data_type from information_schema.columns
 where table_schema = 'public' and table_name = 'matches'
   and column_name in ('status', 'winner', 'sets', 'round', 'side_a_pair_id', 'side_b_pair_id', 'tournament_id', 'updated_at');
select enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'match_status' order by enumsortorder;

-- 3) Función de rol y políticas que la baja necesita (admin/organizer deben poder escribir pairs y matches).
select proname from pg_proc where proname = 'is_admin_or_organizer';
select tablename, policyname, cmd, roles from pg_policies where schemaname = 'public' and tablename in ('pairs', 'matches') order by 1, 2;

-- 4) Triggers en pairs/matches que pudieran reaccionar al cambio de estado o al borrado.
select event_object_table, trigger_name, action_timing, event_manipulation
  from information_schema.triggers where event_object_schema = 'public' and event_object_table in ('pairs', 'matches');

-- 5) Datos actuales: valores distintos de status en pairs (esperado: solo 'confirmed'/'pending').
select status, count(*) from public.pairs group by 1;

-- 6) ¿Ya está instalada la función? (0 filas = no instalada; la app deja las bajas bloqueadas.)
select proname from pg_proc where proname in ('withdraw_pair', 'withdraw_pair_installed');
