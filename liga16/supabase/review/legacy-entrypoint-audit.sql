-- Read-only release gate: report unexpected executable SECURITY DEFINER functions.
-- Installed public metadata snapshot has only is_admin_or_organizer(text[]) as definer.
-- Trigger functions cannot be invoked as ordinary RPC calls; withdraw_pair is INVOKER.
SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),p.prosecdef,
 has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_exec,
 has_function_privilege('anon',p.oid,'EXECUTE') anon_exec
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN('public','private') AND p.prosecdef ORDER BY 1,2,3;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prosecdef AND (p.proname||'('||pg_get_function_identity_arguments(p.oid)||')') NOT IN
 ('is_admin_or_organizer(allowed_roles text[])','organizer_player(tid uuid, player_name text)','record_entry_payment(eid uuid, expected_revision integer, request_id uuid, next_status text, method text, amount integer)','create_entry_resource(tid uuid, request_id uuid, kind text, payload jsonb)','admin_find_users_by_email(p_email text)','admin_list_organizers()','admin_set_organizer_role(p_user uuid, p_make boolean)','admin_set_tournament_organizer(p_tournament uuid, p_user uuid)')) THEN
 RAISE EXCEPTION 'Unexpected SECURITY DEFINER endpoint. Stop release for explicit body/ACL review'; END IF;
END $$;
