-- Review rehearsal precondition, run before both forward files. No writes.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname IN('public','storage') AND (policyname LIKE 'organizer_%' OR policyname LIKE 'legacy_registration_history_%' OR policyname='tournament_parent_visibility')) OR
 EXISTS(SELECT 1 FROM pg_trigger WHERE tgname IN('liga16_tournament_owner','liga16_tournament_club','liga16_club_owner','liga16_tournament_links')) OR
 to_regnamespace('private') IS NOT NULL OR to_regclass('public.tournament_entries') IS NOT NULL OR
 to_regclass('public.tournaments_organizer_id_idx') IS NOT NULL OR
 to_regclass('public.clubs_created_by_idx') IS NOT NULL OR
 EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clubs' AND column_name='created_by') THEN
 RAISE EXCEPTION 'Collision with integrated baseline: stop and inspect; never replace existing objects'; END IF;
END $$;
