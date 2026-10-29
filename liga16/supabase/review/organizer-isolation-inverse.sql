-- REVIEW ONLY. Exact absent-object baseline required; no CASCADE. Entries inverse first.
-- Refuse once owned tournament/club data exists. Never un-scope active organizer data.
BEGIN;
LOCK TABLE public.tournaments,public.clubs IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF to_regclass('public.tournament_entries') IS NOT NULL OR
 EXISTS(SELECT 1 FROM public.tournaments WHERE organizer_id IS NOT NULL) OR
 EXISTS(SELECT 1 FROM public.clubs WHERE created_by IS NOT NULL) THEN
 RAISE EXCEPTION 'Inversa detenida: dependencias/actividad. Conservar datos y reparar hacia adelante'; END IF;
END $$;
DROP POLICY organizer_owner_write ON public.tournaments;
DROP POLICY organizer_tournament_update ON public.tournaments;
DROP POLICY organizer_tournament_delete ON public.tournaments;
DO $$ DECLARE tbl text; cmd text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['tournament_categories','pairs','matches','registrations'] LOOP
  FOREACH cmd IN ARRAY ARRAY['insert','update','delete'] LOOP EXECUTE format('DROP POLICY organizer_scoped_%s ON public.%I',cmd,tbl); END LOOP;
  EXECUTE format('DROP TRIGGER liga16_tournament_links ON public.%I',tbl);
 END LOOP;
 FOREACH tbl IN ARRAY ARRAY['player_profiles','player_cards','teams','leagues','league_divisions','league_teams','news','sponsors','invitations','ranking_events'] LOOP
  FOREACH cmd IN ARRAY ARRAY['insert','update','delete'] LOOP EXECUTE format('DROP POLICY organizer_no_global_%s ON public.%I',cmd,tbl); END LOOP;
 END LOOP;
 FOREACH tbl IN ARRAY ARRAY['tournament_categories','pairs','matches'] LOOP EXECUTE format('DROP POLICY tournament_parent_visibility ON public.%I',tbl); END LOOP;
 FOREACH cmd IN ARRAY ARRAY['insert','update','delete'] LOOP
 EXECUTE format('DROP POLICY organizer_club_%s ON public.clubs',cmd);
 EXECUTE format('DROP POLICY organizer_court_%s ON public.courts',cmd);
 EXECUTE format('DROP POLICY organizer_image_%s ON storage.objects',cmd);
 EXECUTE format('DROP POLICY organizer_image_write_%s ON storage.objects',cmd);
 END LOOP;
END $$;
DROP POLICY organizer_court_new_club ON public.courts;
DROP POLICY organizer_registration_read ON public.registrations;
DROP POLICY legacy_registration_history_insert ON public.registrations;
DROP POLICY legacy_registration_history_update ON public.registrations;
DROP POLICY legacy_registration_history_delete ON public.registrations;
DROP TRIGGER liga16_tournament_owner ON public.tournaments;
DROP TRIGGER liga16_tournament_club ON public.tournaments;
DROP TRIGGER liga16_club_owner ON public.clubs;
DROP INDEX public.tournaments_organizer_id_idx;
DROP INDEX public.clubs_created_by_idx;
ALTER TABLE public.clubs DROP COLUMN created_by;
DROP FUNCTION public.organizer_player(uuid,text);
DROP FUNCTION private.guard_tournament_links();
DROP FUNCTION private.can_view_tournament(uuid);
DROP FUNCTION private.manages_object(text);
DROP FUNCTION private.guard_tournament_club();
DROP FUNCTION private.guard_club_owner();
DROP FUNCTION private.owns_club(uuid);
DROP FUNCTION private.guard_tournament_owner();
DROP FUNCTION private.manages_tournament(uuid);
DROP FUNCTION private.liga16_role();
DROP SCHEMA private;
ROLLBACK; -- Deliberate review gate.
