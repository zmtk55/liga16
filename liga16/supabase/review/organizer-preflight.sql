-- Solo lectura. Ejecutar y guardar el resultado completo antes de revisar despliegue.
BEGIN READ ONLY;
SELECT current_database(), current_user, version();
SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname IN ('public','storage') ORDER BY schemaname,tablename,policyname;
SELECT n.nspname,p.proname,p.prosecdef,pg_get_function_identity_arguments(p.oid) AS args,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('public','private') ORDER BY 1,2;
SELECT event_object_table,trigger_name,action_statement FROM information_schema.triggers
WHERE trigger_schema='public' ORDER BY 1,2;
SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' ORDER BY 1;
SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns
WHERE table_schema='public' ORDER BY table_name,ordinal_position;
SELECT count(*) AS total,count(*) FILTER(WHERE organizer_id IS NULL) AS legacy_null FROM public.tournaments;
SELECT 'pair_category' AS issue,count(*) FROM public.pairs p JOIN public.tournament_categories c ON c.id=p.category_id
WHERE p.tournament_id IS DISTINCT FROM c.tournament_id
UNION ALL SELECT 'registration_category',count(*) FROM public.registrations r JOIN public.tournament_categories c ON c.id=r.category_id
WHERE r.tournament_id IS DISTINCT FROM c.tournament_id
UNION ALL SELECT 'registration_pair',count(*) FROM public.registrations r JOIN public.pairs p ON p.id=r.pair_id
WHERE r.tournament_id IS DISTINCT FROM p.tournament_id OR (r.category_id IS NOT NULL AND r.category_id IS DISTINCT FROM p.category_id)
UNION ALL SELECT 'match_pair',count(*) FROM public.matches m JOIN public.pairs p ON p.id IN(m.side_a_pair_id,m.side_b_pair_id)
WHERE m.tournament_id IS DISTINCT FROM p.tournament_id;
ROLLBACK;
