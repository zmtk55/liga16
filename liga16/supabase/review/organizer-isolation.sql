-- BORRADOR LOCAL. NO APLICAR: falta preflight real, revisión de alcance y pruebas API/Storage. No concede roles a ninguna cuenta.
-- Propuesta integrada: backend y cliente deben revisarse juntos.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM public;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.liga16_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = (SELECT auth.uid())
$$;
REVOKE ALL ON FUNCTION private.liga16_role() FROM public;
GRANT EXECUTE ON FUNCTION private.liga16_role() TO authenticated;

CREATE OR REPLACE FUNCTION private.manages_tournament(tid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN (SELECT auth.uid()) IS NULL THEN false
    WHEN private.liga16_role() = 'admin' THEN true
    WHEN private.liga16_role() = 'organizer' THEN EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tid AND t.organizer_id = (SELECT auth.uid())
    ) ELSE false END
$$;
REVOKE ALL ON FUNCTION private.manages_tournament(uuid) FROM public;
GRANT EXECUTE ON FUNCTION private.manages_tournament(uuid) TO authenticated;
CREATE INDEX IF NOT EXISTS tournaments_organizer_id_idx ON public.tournaments(organizer_id);

-- Los torneos históricos NULL continúan solo bajo administración global.
-- Un organizer no puede apropiárselos ni asignar sus torneos a otra cuenta.
CREATE OR REPLACE FUNCTION private.guard_tournament_owner()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF private.liga16_role() = 'organizer' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.organizer_id IS NOT NULL AND NEW.organizer_id <> (SELECT auth.uid()) THEN
        RAISE EXCEPTION 'No puedes asignar otro organizador' USING ERRCODE='42501';
      END IF;
      NEW.organizer_id := (SELECT auth.uid());
    ELSIF NEW.organizer_id IS DISTINCT FROM OLD.organizer_id THEN
      RAISE EXCEPTION 'Solo el administrador puede cambiar al organizador' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_tournament_owner() FROM public;
DROP TRIGGER IF EXISTS liga16_tournament_owner ON public.tournaments;
CREATE TRIGGER liga16_tournament_owner BEFORE INSERT OR UPDATE ON public.tournaments
FOR EACH ROW EXECUTE FUNCTION private.guard_tournament_owner();

-- Restrictive policies se combinan con AND con las políticas permisivas existentes.
-- Agregar otra permisiva no podría cerrar los grants globales actuales (OR).
DROP POLICY IF EXISTS organizer_owner_write ON public.tournaments;
CREATE POLICY organizer_owner_write ON public.tournaments AS RESTRICTIVE FOR ALL TO authenticated
USING (private.liga16_role() IS DISTINCT FROM 'organizer' OR organizer_id = (SELECT auth.uid()) OR status <> 'draft')
WITH CHECK (private.liga16_role() IS DISTINCT FROM 'organizer' OR organizer_id = (SELECT auth.uid()));
-- SELECT público de otros torneos se conserva; UPDATE/DELETE deben usar ownership, no status.
DROP POLICY IF EXISTS organizer_tournament_update ON public.tournaments;
CREATE POLICY organizer_tournament_update ON public.tournaments AS RESTRICTIVE FOR UPDATE TO authenticated
USING (private.liga16_role() IS DISTINCT FROM 'organizer' OR private.manages_tournament(id))
WITH CHECK (private.liga16_role() IS DISTINCT FROM 'organizer' OR private.manages_tournament(id));
DROP POLICY IF EXISTS organizer_tournament_delete ON public.tournaments;
CREATE POLICY organizer_tournament_delete ON public.tournaments AS RESTRICTIVE FOR DELETE TO authenticated
USING (private.liga16_role() IS DISTINCT FROM 'organizer' OR private.manages_tournament(id));

DO $block$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['tournament_categories','pairs','matches','registrations'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS organizer_scoped_insert ON public.%I',tbl);
    EXECUTE format('CREATE POLICY organizer_scoped_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (private.liga16_role() IS DISTINCT FROM ''organizer'' OR private.manages_tournament(tournament_id))',tbl);
    EXECUTE format('DROP POLICY IF EXISTS organizer_scoped_update ON public.%I',tbl);
    EXECUTE format('CREATE POLICY organizer_scoped_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (private.liga16_role() IS DISTINCT FROM ''organizer'' OR private.manages_tournament(tournament_id)) WITH CHECK (private.liga16_role() IS DISTINCT FROM ''organizer'' OR private.manages_tournament(tournament_id))',tbl);
    EXECUTE format('DROP POLICY IF EXISTS organizer_scoped_delete ON public.%I',tbl);
    EXECUTE format('CREATE POLICY organizer_scoped_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (private.liga16_role() IS DISTINCT FROM ''organizer'' OR private.manages_tournament(tournament_id))',tbl);
  END LOOP;
  -- Catálogos globales no pertenecen a un torneo. No dar edición global por accidente.
  FOREACH tbl IN ARRAY ARRAY['player_profiles','player_cards','teams','leagues','league_divisions','league_teams','news','sponsors','invitations','ranking_events'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS organizer_no_global_insert ON public.%I',tbl);
    EXECUTE format('CREATE POLICY organizer_no_global_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (private.liga16_role() IS DISTINCT FROM ''organizer'')',tbl);
    EXECUTE format('DROP POLICY IF EXISTS organizer_no_global_update ON public.%I',tbl);
    EXECUTE format('CREATE POLICY organizer_no_global_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (private.liga16_role() IS DISTINCT FROM ''organizer'') WITH CHECK (private.liga16_role() IS DISTINCT FROM ''organizer'')',tbl);
    EXECUTE format('DROP POLICY IF EXISTS organizer_no_global_delete ON public.%I',tbl);
    EXECUTE format('CREATE POLICY organizer_no_global_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (private.liga16_role() IS DISTINCT FROM ''organizer'')',tbl);
  END LOOP;
END $block$;
-- Mantiene el acceso de cada jugador a SU inscripción; no expone pagos ajenos.
DROP POLICY IF EXISTS organizer_registration_read ON public.registrations;
CREATE POLICY organizer_registration_read ON public.registrations AS RESTRICTIVE FOR SELECT TO authenticated
USING (private.liga16_role() IS DISTINCT FROM 'organizer' OR private.manages_tournament(tournament_id) OR user_id=(SELECT auth.uid()));

-- Legacy registrations are historical only, for every authenticated role.
DROP POLICY IF EXISTS legacy_registration_history_insert ON public.registrations;
CREATE POLICY legacy_registration_history_insert ON public.registrations AS RESTRICTIVE FOR INSERT TO anon,authenticated WITH CHECK(false);
DROP POLICY IF EXISTS legacy_registration_history_update ON public.registrations;
CREATE POLICY legacy_registration_history_update ON public.registrations AS RESTRICTIVE FOR UPDATE TO anon,authenticated USING(false) WITH CHECK(false);
DROP POLICY IF EXISTS legacy_registration_history_delete ON public.registrations;
CREATE POLICY legacy_registration_history_delete ON public.registrations AS RESTRICTIVE FOR DELETE TO anon,authenticated USING(false);
-- Sedes creadas por organizer se distinguen de los catálogos históricos NULL.
-- Reusar sedes existentes es lectura; jamás permite editarlas o adoptar su dueño.
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS clubs_created_by_idx ON public.clubs(created_by);
CREATE OR REPLACE FUNCTION private.owns_club(cid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS(SELECT 1 FROM public.clubs c WHERE c.id=cid AND c.created_by=(SELECT auth.uid()))
$$;
REVOKE ALL ON FUNCTION private.owns_club(uuid) FROM public;
GRANT EXECUTE ON FUNCTION private.owns_club(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION private.guard_club_owner()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF private.liga16_role()='organizer' THEN
    IF TG_OP='INSERT' THEN
      IF NEW.created_by IS NOT NULL AND NEW.created_by<>(SELECT auth.uid()) THEN
        RAISE EXCEPTION 'No puedes asignar otra sede' USING ERRCODE='42501';
      END IF;
      NEW.created_by:=(SELECT auth.uid());
    ELSIF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      RAISE EXCEPTION 'No puedes cambiar al dueño de la sede' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_club_owner() FROM public;
DROP TRIGGER IF EXISTS liga16_club_owner ON public.clubs;
CREATE TRIGGER liga16_club_owner BEFORE INSERT OR UPDATE ON public.clubs
FOR EACH ROW EXECUTE FUNCTION private.guard_club_owner();
DROP POLICY IF EXISTS organizer_club_insert ON public.clubs;
CREATE POLICY organizer_club_insert ON public.clubs AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK(private.liga16_role() IS DISTINCT FROM 'organizer' OR created_by=(SELECT auth.uid()));
DROP POLICY IF EXISTS organizer_club_update ON public.clubs;
CREATE POLICY organizer_club_update ON public.clubs AS RESTRICTIVE FOR UPDATE TO authenticated
USING(private.liga16_role() IS DISTINCT FROM 'organizer' OR private.owns_club(id))
WITH CHECK(private.liga16_role() IS DISTINCT FROM 'organizer' OR created_by=(SELECT auth.uid()));
DROP POLICY IF EXISTS organizer_club_delete ON public.clubs;
CREATE POLICY organizer_club_delete ON public.clubs AS RESTRICTIVE FOR DELETE TO authenticated
USING(private.liga16_role() IS DISTINCT FROM 'organizer' OR private.owns_club(id));
DO $block$
DECLARE cmd text;
BEGIN
  FOREACH cmd IN ARRAY ARRAY['UPDATE','DELETE'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS organizer_court_%s ON public.courts',lower(cmd));
    EXECUTE format('CREATE POLICY organizer_court_%s ON public.courts AS RESTRICTIVE FOR %s TO authenticated USING(private.liga16_role() IS DISTINCT FROM ''organizer'' OR private.owns_club(club_id))',lower(cmd),cmd);
  END LOOP;
END $block$;
DROP POLICY IF EXISTS organizer_court_insert ON public.courts;
CREATE POLICY organizer_court_insert ON public.courts AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK(private.liga16_role() IS DISTINCT FROM 'organizer' OR private.owns_club(club_id));
-- Update necesita validar OLD y NEW, también si cambia club_id.
DROP POLICY IF EXISTS organizer_court_new_club ON public.courts;
CREATE POLICY organizer_court_new_club ON public.courts AS RESTRICTIVE FOR UPDATE TO authenticated
USING(true) WITH CHECK(private.liga16_role() IS DISTINCT FROM 'organizer' OR private.owns_club(club_id));

CREATE OR REPLACE FUNCTION private.guard_tournament_club()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.liga16_role()='organizer' AND NEW.club_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.clubs c WHERE c.id=NEW.club_id AND c.created_by IS NOT NULL
      AND c.created_by IS DISTINCT FROM (SELECT auth.uid())) THEN
    RAISE EXCEPTION 'Sede de otro organizador' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_tournament_club() FROM public;
DROP TRIGGER IF EXISTS liga16_tournament_club ON public.tournaments;
CREATE TRIGGER liga16_tournament_club BEFORE INSERT OR UPDATE ON public.tournaments
FOR EACH ROW EXECUTE FUNCTION private.guard_tournament_club();

-- Alta mínima desde un torneo propio. No modifica perfiles globales existentes,
-- no acepta user_id/role/official_level/status del navegador.
-- Base preflight requerida: status (self-registration) y guard/trigger player_cards.
CREATE OR REPLACE FUNCTION public.organizer_player(tid uuid, player_name text)
RETURNS SETOF public.player_profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE clean text:=btrim(player_name); result public.player_profiles;
BEGIN
  IF private.liga16_role() IS DISTINCT FROM 'organizer' OR NOT private.manages_tournament(tid) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  IF clean IS NULL OR length(clean)<2 OR length(clean)>120 THEN
    RAISE EXCEPTION 'Nombre inválido' USING ERRCODE='22023';
  END IF;
  -- Un nombre no prueba identidad, aunque solo haya una coincidencia.
  IF EXISTS(SELECT 1 FROM public.player_profiles p WHERE p.is_public AND lower(btrim(p.display_name))=lower(clean)) THEN
    RAISE EXCEPTION 'Selecciona el perfil existente por su ID' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.player_profiles(display_name,username,city,state,country,role,is_public,status)
  VALUES(clean,'jug-'||replace(gen_random_uuid()::text,'-',''),'','', 'MX','player',true,'pendiente') RETURNING * INTO result;
  RETURN NEXT result;
END $$;
REVOKE ALL ON FUNCTION public.organizer_player(uuid,text) FROM public;
GRANT EXECUTE ON FUNCTION public.organizer_player(uuid,text) TO authenticated;

-- Escrituras Storage nuevas: tournaments/<UUID>/<archivo>. URLs viejas no cambian.
CREATE OR REPLACE FUNCTION private.manages_object(path text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE tid uuid;
BEGIN
  IF split_part(path,'/',1)<>'tournaments' THEN RETURN false; END IF;
  BEGIN tid:=split_part(path,'/',2)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RETURN false; END;
  RETURN private.liga16_role()='organizer' AND private.manages_tournament(tid);
END $$;
REVOKE ALL ON FUNCTION private.manages_object(text) FROM public;
GRANT EXECUTE ON FUNCTION private.manages_object(text) TO authenticated;
-- Se limita a los dos buckets de imágenes usados; no extiende otros buckets.
DROP POLICY IF EXISTS organizer_image_insert ON storage.objects;
CREATE POLICY organizer_image_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id IN ('team-crests','tournament-covers') AND private.manages_object(name));
DROP POLICY IF EXISTS organizer_image_update ON storage.objects;
CREATE POLICY organizer_image_update ON storage.objects FOR UPDATE TO authenticated
USING(bucket_id IN ('team-crests','tournament-covers') AND private.manages_object(name))
WITH CHECK(bucket_id IN ('team-crests','tournament-covers') AND private.manages_object(name));
DROP POLICY IF EXISTS organizer_image_delete ON storage.objects;
CREATE POLICY organizer_image_delete ON storage.objects FOR DELETE TO authenticated
USING(bucket_id IN ('team-crests','tournament-covers') AND private.manages_object(name));
-- Las políticas nuevas no bastan si existiera otra permisiva global.
-- Restringir SOLO escrituras: no impedir leer imágenes públicas ajenas.
DROP POLICY IF EXISTS organizer_image_scope ON storage.objects;
DROP POLICY IF EXISTS organizer_image_write_insert ON storage.objects;
CREATE POLICY organizer_image_write_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK(private.liga16_role() IS DISTINCT FROM 'organizer' OR
 (bucket_id IN ('team-crests','tournament-covers') AND private.manages_object(name)));
DROP POLICY IF EXISTS organizer_image_write_update ON storage.objects;
CREATE POLICY organizer_image_write_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
USING(private.liga16_role() IS DISTINCT FROM 'organizer' OR
 (bucket_id IN ('team-crests','tournament-covers') AND private.manages_object(name)))
WITH CHECK(private.liga16_role() IS DISTINCT FROM 'organizer' OR
 (bucket_id IN ('team-crests','tournament-covers') AND private.manages_object(name)));
DROP POLICY IF EXISTS organizer_image_write_delete ON storage.objects;
CREATE POLICY organizer_image_write_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
USING(private.liga16_role() IS DISTINCT FROM 'organizer' OR
 (bucket_id IN ('team-crests','tournament-covers') AND private.manages_object(name)));

-- La lectura pública de dependencias debe seguir la visibilidad del padre.
CREATE OR REPLACE FUNCTION private.can_view_tournament(tid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.liga16_role()='admin' OR EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id=tid
    AND (t.status <> 'draft' OR private.manages_tournament(t.id)))
$$;
REVOKE ALL ON FUNCTION private.can_view_tournament(uuid) FROM public;
GRANT USAGE ON SCHEMA private TO anon;
GRANT EXECUTE ON FUNCTION private.can_view_tournament(uuid) TO anon,authenticated;
DO $block$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['tournament_categories','pairs','matches'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS tournament_parent_visibility ON public.%I',tbl);
    EXECUTE format('CREATE POLICY tournament_parent_visibility ON public.%I AS RESTRICTIVE FOR SELECT TO anon,authenticated USING (private.can_view_tournament(tournament_id))',tbl);
  END LOOP;
END $block$;

-- Integridad nueva: no reubicar dependencias ni mezclar IDs de otros torneos.
-- No reescribe filas históricas; el preflight debe detectar anomalías previas.
CREATE OR REPLACE FUNCTION private.guard_tournament_links()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE related uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.tournament_id IS DISTINCT FROM OLD.tournament_id
     AND private.liga16_role() = 'organizer' THEN
    RAISE EXCEPTION 'No puedes mover filas entre torneos' USING ERRCODE='42501';
  END IF;
  IF TG_TABLE_NAME IN ('pairs','registrations') THEN
    IF NEW.category_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.tournament_categories c WHERE c.id=NEW.category_id
        AND c.tournament_id=NEW.tournament_id) THEN
      RAISE EXCEPTION 'Categoría de otro torneo' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_TABLE_NAME = 'registrations' THEN
    IF NEW.pair_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.pairs p WHERE p.id=NEW.pair_id AND p.tournament_id=NEW.tournament_id
        AND (NEW.category_id IS NULL OR p.category_id=NEW.category_id)) THEN
      RAISE EXCEPTION 'Pareja de otro torneo o categoría' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_TABLE_NAME = 'matches' THEN
    FOREACH related IN ARRAY ARRAY[NEW.side_a_pair_id,NEW.side_b_pair_id] LOOP
      IF related IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.pairs p WHERE p.id=related AND p.tournament_id=NEW.tournament_id) THEN
        RAISE EXCEPTION 'Participante de otro torneo' USING ERRCODE='23514';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_tournament_links() FROM public;
DO $block$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['tournament_categories','pairs','matches','registrations'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS liga16_tournament_links ON public.%I',tbl);
    EXECUTE format('CREATE TRIGGER liga16_tournament_links BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.guard_tournament_links()',tbl);
  END LOOP;
END $block$;
-- TODO antes de considerar aplicable:
-- Contrastar catálogo instalado, triggers de perfiles, RPC y comportamiento de Storage;
-- validar cliente completo y consentimiento de despliegue. No backfill de owner NULL.
ROLLBACK; -- A propósito: revisión, NO migración de despliegue.
