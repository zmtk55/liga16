-- BORRADOR LOCAL. NO APLICAR: falta revisión del administrador y aprobación del dueño.
-- Pantalla admin de organizadores: búsqueda de cuentas por correo, alta/baja del
-- rol organizer y asignación de torneos (tournaments.organizer_id).
--
-- Las cuatro funciones son SECURITY DEFINER porque leen/escriben auth.users,
-- inalcanzable para el rol authenticated. Todas cierran con el mismo candado:
-- private.liga16_role() = 'admin' o 42501. Un no-administrador no puede
-- enumerar correos ni tocar roles aunque conozca el nombre de la función.
-- Alta/baja y asignación son idempotentes: repetir la misma llamada no cambia
-- nada y devuelve el mismo resultado.
BEGIN;

-- Búsqueda acotada por correo: coincidencia exacta primero, luego prefijo,
-- máximo 10 filas. Devuelve solo id, correo y rol; nada más de auth.users.
CREATE OR REPLACE FUNCTION public.admin_find_users_by_email(p_email text)
RETURNS TABLE(id uuid, email text, role text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_email text := lower(btrim(p_email));
BEGIN
  IF private.liga16_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Solo el administrador puede buscar usuarios' USING ERRCODE = '42501';
  END IF;
  IF length(v_email) < 3 THEN
    RAISE EXCEPTION 'Escribe al menos 3 caracteres del correo' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT u.id, u.email::text, u.raw_app_meta_data->>'role'
    FROM auth.users u
    WHERE lower(u.email) = v_email OR lower(u.email) LIKE v_email || '%'
    ORDER BY (lower(u.email) = v_email) DESC, lower(u.email)
    LIMIT 10;
END $$;
REVOKE ALL ON FUNCTION public.admin_find_users_by_email(text) FROM public;
REVOKE ALL ON FUNCTION public.admin_find_users_by_email(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_find_users_by_email(text) TO authenticated;

-- Vista general de la pantalla: solo las cuentas que hoy tienen el rol,
-- sin exponer el resto del directorio.
CREATE OR REPLACE FUNCTION public.admin_list_organizers()
RETURNS TABLE(id uuid, email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.liga16_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Solo el administrador puede listar organizadores' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT u.id, u.email::text
    FROM auth.users u
    WHERE u.raw_app_meta_data->>'role' = 'organizer'
    ORDER BY lower(u.email);
END $$;
REVOKE ALL ON FUNCTION public.admin_list_organizers() FROM public;
REVOKE ALL ON FUNCTION public.admin_list_organizers() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_organizers() TO authenticated;

-- Alta o baja del rol organizer. Solo toca cuentas player/organizer: cualquier
-- otro rol (admin, captain, club, sponsor) se rechaza para no pisar accesos
-- que esta pantalla no entiende. La baja exige que no le queden torneos
-- asignados, para no dejar torneos apuntando a una cuenta sin acceso.
-- El cambio toma efecto cuando la cuenta renueva su sesión (re-login o
-- refresco del token), igual que cualquier cambio en raw_app_meta_data.
CREATE OR REPLACE FUNCTION public.admin_set_organizer_role(p_user uuid, p_make boolean)
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_role text;
  v_tournaments integer;
BEGIN
  IF private.liga16_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Solo el administrador puede cambiar roles' USING ERRCODE = '42501';
  END IF;
  SELECT u.raw_app_meta_data->>'role' INTO v_role
    FROM auth.users u WHERE u.id = p_user;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe una cuenta con ese identificador' USING ERRCODE = '22023';
  END IF;
  IF v_role = 'admin' THEN
    RAISE EXCEPTION 'Esta pantalla no cambia cuentas de administrador' USING ERRCODE = '42501';
  END IF;
  IF p_make THEN
    IF v_role IS NOT NULL AND v_role NOT IN ('player', 'organizer') THEN
      RAISE EXCEPTION 'La cuenta tiene rol % y no se puede convertir desde aquí', v_role USING ERRCODE = '42501';
    END IF;
    IF v_role IS DISTINCT FROM 'organizer' THEN
      UPDATE auth.users u
        SET raw_app_meta_data = u.raw_app_meta_data || jsonb_build_object('role', 'organizer')
        WHERE u.id = p_user;
    END IF;
    RETURN 'organizer';
  END IF;
  IF v_role IS DISTINCT FROM 'organizer' THEN
    RETURN COALESCE(v_role, 'player');
  END IF;
  SELECT count(*) INTO v_tournaments FROM public.tournaments t WHERE t.organizer_id = p_user;
  IF v_tournaments > 0 THEN
    RAISE EXCEPTION 'La cuenta todavía organiza % torneo(s); desasígnalos antes de quitar el rol', v_tournaments USING ERRCODE = '23503';
  END IF;
  UPDATE auth.users u
    SET raw_app_meta_data = u.raw_app_meta_data || jsonb_build_object('role', 'player')
    WHERE u.id = p_user;
  RETURN 'player';
END $$;
REVOKE ALL ON FUNCTION public.admin_set_organizer_role(uuid, boolean) FROM public;
REVOKE ALL ON FUNCTION public.admin_set_organizer_role(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_organizer_role(uuid, boolean) TO authenticated;

-- Asigna un torneo a un organizador (o lo desasigna con p_user NULL). La cuenta
-- destino debe tener el rol organizer; si no, se pide darlo primero para que
-- el acceso y la asignación nunca queden desalineados.
CREATE OR REPLACE FUNCTION public.admin_set_tournament_organizer(p_tournament uuid, p_user uuid)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_role text;
BEGIN
  IF private.liga16_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Solo el administrador puede asignar torneos' USING ERRCODE = '42501';
  END IF;
  IF p_user IS NOT NULL THEN
    SELECT u.raw_app_meta_data->>'role' INTO v_role
      FROM auth.users u WHERE u.id = p_user;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No existe una cuenta con ese identificador' USING ERRCODE = '22023';
    END IF;
    IF v_role IS DISTINCT FROM 'organizer' THEN
      RAISE EXCEPTION 'Primero dale el rol de organizador a la cuenta' USING ERRCODE = '42501';
    END IF;
  END IF;
  UPDATE public.tournaments t SET organizer_id = p_user WHERE t.id = p_tournament;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe un torneo con ese identificador' USING ERRCODE = '22023';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_set_tournament_organizer(uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION public.admin_set_tournament_organizer(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_tournament_organizer(uuid, uuid) TO authenticated;
COMMIT;
