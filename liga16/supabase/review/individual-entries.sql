-- BORRADOR ADITIVO LOCAL. NO APLICAR. Sin backfill ni copia de pagos existentes.
-- Requiere helpers private.liga16_role/manages_tournament del borrador de aislamiento.
-- No cambia categorías/niveles/scoring. No presupone importe individual desde precio viejo.
BEGIN;
CREATE TABLE IF NOT EXISTS public.tournament_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id),
  player_id uuid NOT NULL REFERENCES public.player_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tournament_id,player_id)
);
CREATE TABLE IF NOT EXISTS public.entry_payments (
  entry_id uuid PRIMARY KEY REFERENCES public.tournament_entries(id),
  status text NOT NULL DEFAULT 'payment_pending' CHECK(status IN('payment_pending','payment_review','paid','cancelled','refunded')),
  payment_method text CHECK(payment_method IN('cash','transfer','stripe','mercado_pago')),
  amount_cents integer CHECK(amount_cents IS NULL OR amount_cents>=0),
  paid_at timestamptz,
  revision integer NOT NULL DEFAULT 0,
  CHECK(status<>'paid' OR paid_at IS NOT NULL)
);
ALTER TABLE public.tournament_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_payments ENABLE ROW LEVEL SECURITY;
-- Explicit revoke avoids inheriting writes from database default privileges.
REVOKE ALL ON public.tournament_entries FROM public,anon,authenticated;
REVOKE ALL ON public.entry_payments FROM public,anon,authenticated;
GRANT SELECT,INSERT ON public.tournament_entries TO authenticated;
GRANT SELECT,UPDATE ON public.entry_payments TO authenticated;
-- No DELETE, UPDATE identity, direct INSERT payment or public read granted.
-- Nunca eliminar filas monetarias/históricas por cascada al borrar torneo/jugador.
CREATE OR REPLACE FUNCTION private.owns_entry(eid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.tournament_entries e JOIN public.player_profiles p ON p.id=e.player_id
 WHERE e.id=eid AND p.user_id=(SELECT auth.uid()))
$$;
REVOKE ALL ON FUNCTION private.owns_entry(uuid) FROM public;
GRANT EXECUTE ON FUNCTION private.owns_entry(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION private.manages_entry(eid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.tournament_entries e WHERE e.id=eid AND private.manages_tournament(e.tournament_id))
$$;
REVOKE ALL ON FUNCTION private.manages_entry(uuid) FROM public;
GRANT EXECUTE ON FUNCTION private.manages_entry(uuid) TO authenticated;
DROP POLICY IF EXISTS entry_read ON public.tournament_entries;
CREATE POLICY entry_read ON public.tournament_entries FOR SELECT TO authenticated
USING(private.manages_tournament(tournament_id) OR EXISTS(
 SELECT 1 FROM public.player_profiles p WHERE p.id=player_id AND p.user_id=(SELECT auth.uid())
));
DROP POLICY IF EXISTS entry_create ON public.tournament_entries;
CREATE POLICY entry_create ON public.tournament_entries FOR INSERT TO authenticated
WITH CHECK(private.manages_tournament(tournament_id) OR (
 EXISTS(SELECT 1 FROM public.player_profiles p WHERE p.id=player_id AND p.user_id=(SELECT auth.uid()))
 AND EXISTS(SELECT 1 FROM public.tournaments t WHERE t.id=tournament_id AND t.status='registration_open')
));
DROP POLICY IF EXISTS entry_payment_read ON public.entry_payments;
CREATE POLICY entry_payment_read ON public.entry_payments FOR SELECT TO authenticated
USING(private.manages_entry(entry_id) OR private.owns_entry(entry_id));
DROP POLICY IF EXISTS entry_payment_update ON public.entry_payments;
CREATE POLICY entry_payment_update ON public.entry_payments FOR UPDATE TO authenticated
USING(private.manages_entry(entry_id)) WITH CHECK(private.manages_entry(entry_id));
CREATE OR REPLACE FUNCTION private.initialize_entry_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.entry_payments(entry_id) VALUES(NEW.id);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.initialize_entry_payment() FROM public;
DROP TRIGGER IF EXISTS initialize_entry_payment ON public.tournament_entries;
CREATE TRIGGER initialize_entry_payment AFTER INSERT ON public.tournament_entries
FOR EACH ROW EXECUTE FUNCTION private.initialize_entry_payment();
-- Identidad inmutable incluso para admin: cambiar jugador/torneo es crear otra inscripción.
CREATE OR REPLACE FUNCTION private.guard_entry_payment_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.entry_id IS DISTINCT FROM OLD.entry_id THEN
   RAISE EXCEPTION 'No se puede reasignar un pago' USING ERRCODE='42501';
 END IF;
 NEW.revision:=OLD.revision+1;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_entry_payment_identity() FROM public;
DROP TRIGGER IF EXISTS guard_entry_payment_identity ON public.entry_payments;
CREATE TRIGGER guard_entry_payment_identity BEFORE UPDATE ON public.entry_payments
FOR EACH ROW EXECUTE FUNCTION private.guard_entry_payment_identity();
-- Endpoint de pago con revisión obligatoria y auditoría, sin aceptar otro entry_id.
CREATE TABLE IF NOT EXISTS private.entry_payment_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 entry_id uuid NOT NULL REFERENCES public.tournament_entries(id),
 actor_id uuid NOT NULL,
 changed_at timestamptz NOT NULL DEFAULT now(),
 old_value jsonb NOT NULL,
 new_value jsonb NOT NULL
);
REVOKE ALL ON private.entry_payment_audit FROM public,anon,authenticated;
REVOKE UPDATE ON public.entry_payments FROM PUBLIC,anon,authenticated;
DO $$ BEGIN
 IF has_table_privilege('authenticated','public.entry_payments','UPDATE') OR
 has_any_column_privilege('authenticated','public.entry_payments','UPDATE') OR
 has_table_privilege('anon','public.entry_payments','UPDATE') OR
 has_any_column_privilege('anon','public.entry_payments','UPDATE') THEN
 RAISE EXCEPTION 'Existe otra ruta de escritura a entry_payments: revisar grants antes de continuar'; END IF;
END $$;
DROP FUNCTION IF EXISTS public.record_entry_payment(uuid,integer,text,text,integer);
-- One mandatory operation protocol, ported from the isolated legacy concurrency experiment.
CREATE TABLE IF NOT EXISTS private.entry_payment_requests (
 actor_id uuid NOT NULL, request_id uuid NOT NULL, entry_id uuid NOT NULL REFERENCES public.tournament_entries(id),
 expected_revision integer NOT NULL, payload jsonb NOT NULL, response jsonb NOT NULL,
 PRIMARY KEY(actor_id,request_id)
);
REVOKE ALL ON private.entry_payment_requests FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.record_entry_payment(
 eid uuid, expected_revision integer, request_id uuid, next_status text, method text, amount integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); prior public.entry_payments; result public.entry_payments;
 saved private.entry_payment_requests; body jsonb:=jsonb_build_object('status',next_status,'method',method,'amount',amount);
BEGIN
 IF actor IS NULL OR expected_revision IS NULL OR request_id IS NULL THEN
  RAISE EXCEPTION 'Falta identidad, revisión o clave de operación' USING ERRCODE='22023';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||request_id::text,0));
 SELECT * INTO prior FROM public.entry_payments WHERE entry_id=eid FOR UPDATE;
 IF NOT FOUND OR NOT private.manages_entry(eid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO saved FROM private.entry_payment_requests r WHERE r.actor_id=actor AND r.request_id=record_entry_payment.request_id;
 IF FOUND THEN
  IF saved.entry_id<>eid OR saved.expected_revision<>record_entry_payment.expected_revision OR saved.payload<>body THEN
   RAISE EXCEPTION 'La clave de operación ya se usó con otros datos' USING ERRCODE='22023';
  END IF;
  RETURN saved.response;
 END IF;
 IF prior.revision<>expected_revision THEN RAISE EXCEPTION 'El pago cambió: recarga antes de guardar' USING ERRCODE='40001'; END IF;
 UPDATE public.entry_payments SET status=next_status,payment_method=method,
 amount_cents=amount,paid_at=CASE WHEN next_status='paid' THEN coalesce(prior.paid_at,now()) ELSE NULL END
 WHERE entry_id=eid RETURNING * INTO result;
 INSERT INTO private.entry_payment_audit(entry_id,actor_id,old_value,new_value)
 VALUES(eid,actor,to_jsonb(prior),to_jsonb(result));
 INSERT INTO private.entry_payment_requests VALUES(actor,request_id,eid,expected_revision,body,to_jsonb(result));
 RETURN to_jsonb(result);
END $$;
REVOKE ALL ON FUNCTION public.record_entry_payment(uuid,integer,uuid,text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_entry_payment(uuid,integer,uuid,text,text,integer) TO authenticated;
CREATE OR REPLACE FUNCTION private.guard_entry_identity() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN IF NEW.id IS DISTINCT FROM OLD.id OR NEW.tournament_id IS DISTINCT FROM OLD.tournament_id OR NEW.player_id IS DISTINCT FROM OLD.player_id THEN
 RAISE EXCEPTION 'No se puede reasignar una inscripción' USING ERRCODE='42501'; END IF; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION private.guard_entry_identity() FROM PUBLIC;
DROP TRIGGER IF EXISTS guard_entry_identity ON public.tournament_entries;
CREATE TRIGGER guard_entry_identity BEFORE UPDATE ON public.tournament_entries FOR EACH ROW EXECUTE FUNCTION private.guard_entry_identity();
-- Sin tarifa ni confirmación automática de dinero en la autoinscripción.
CREATE OR REPLACE FUNCTION public.enter_my_tournament(tid uuid)
RETURNS public.tournament_entries
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE pid uuid; result public.tournament_entries;
BEGIN
 IF (SELECT count(*) FROM public.player_profiles WHERE user_id=(SELECT auth.uid()))<>1 THEN RAISE EXCEPTION 'Revisa la identidad de tu perfil' USING ERRCODE='42501'; END IF;
 SELECT id INTO pid FROM public.player_profiles WHERE user_id=(SELECT auth.uid());
 IF pid IS NULL THEN RAISE EXCEPTION 'Completa tu perfil antes de inscribirte' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.tournaments WHERE id=tid AND status='registration_open') THEN
   RAISE EXCEPTION 'Inscripciones cerradas' USING ERRCODE='42501';
 END IF;
 SELECT * INTO result FROM public.tournament_entries WHERE tournament_id=tid AND player_id=pid;
 IF FOUND THEN RETURN result; END IF;
 INSERT INTO public.tournament_entries(tournament_id,player_id) VALUES(tid,pid)
 ON CONFLICT(tournament_id,player_id) DO NOTHING RETURNING * INTO result;
 IF NOT FOUND THEN
   SELECT * INTO result FROM public.tournament_entries WHERE tournament_id=tid AND player_id=pid;
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.enter_my_tournament(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.enter_my_tournament(uuid) TO authenticated;
-- Alta administrativa del ID explícito, independiente de cuenta o pareja.
CREATE OR REPLACE FUNCTION public.ensure_tournament_entry(tid uuid,pid uuid)
RETURNS public.tournament_entries LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result public.tournament_entries;
BEGIN
 IF NOT coalesce(private.manages_tournament(tid),false) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 INSERT INTO public.tournament_entries(tournament_id,player_id) VALUES(tid,pid)
 ON CONFLICT(tournament_id,player_id) DO NOTHING RETURNING * INTO result;
 IF NOT FOUND THEN SELECT * INTO result FROM public.tournament_entries WHERE tournament_id=tid AND player_id=pid; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.ensure_tournament_entry(uuid,uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.ensure_tournament_entry(uuid,uuid) TO authenticated;
-- Retire non-idempotent name-create endpoint in the coordinated entries target.
REVOKE ALL ON FUNCTION public.organizer_player(uuid,text) FROM PUBLIC,anon,authenticated;
-- Creation receipts survive a lost FIRST response. Names never identify existing players.
CREATE TABLE IF NOT EXISTS private.entry_create_requests(
 actor_id uuid NOT NULL,request_id uuid NOT NULL,kind text NOT NULL,payload jsonb NOT NULL,response jsonb NOT NULL,
 PRIMARY KEY(actor_id,request_id)
);
REVOKE ALL ON private.entry_create_requests FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.create_entry_resource(tid uuid,request_id uuid,kind text,payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); saved private.entry_create_requests; result jsonb; player public.player_profiles; pair public.pairs;
BEGIN
 IF actor IS NULL OR request_id IS NULL OR NOT coalesce(private.manages_tournament(tid),false) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF kind IS NULL OR kind NOT IN('player','pair') OR payload IS NULL THEN RAISE EXCEPTION 'invalid resource' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||request_id::text,0));
 SELECT * INTO saved FROM private.entry_create_requests r WHERE r.actor_id=actor AND r.request_id=create_entry_resource.request_id;
 IF FOUND THEN
 IF saved.kind<>kind OR saved.payload<>jsonb_build_object('tid',tid,'data',payload) THEN RAISE EXCEPTION 'operation key reused' USING ERRCODE='22023'; END IF;
 RETURN saved.response; END IF;
 IF kind='player' THEN
 IF payload-ARRAY['display_name']<>'{}'::jsonb OR length(btrim(payload->>'display_name')) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'invalid player fields' USING ERRCODE='22023'; END IF;
 INSERT INTO public.player_profiles(display_name,username,city,state,country,role,is_public,status)
 VALUES(btrim(payload->>'display_name'),'jug-'||replace(gen_random_uuid()::text,'-',''),'','','MX','player',true,'pendiente') RETURNING * INTO player;
 result:=to_jsonb(player);
 ELSE
 IF payload-ARRAY['name','category_id','player1_id','player2_id','crest_url','seed']<>'{}'::jsonb OR nullif(btrim(payload->>'name'),'') IS NULL THEN RAISE EXCEPTION 'invalid pair fields' USING ERRCODE='22023'; END IF;
 IF payload->>'player1_id' IS NULL OR payload->>'player2_id' IS NULL OR payload->>'player1_id'=payload->>'player2_id' THEN RAISE EXCEPTION 'invalid player identities' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM public.player_profiles p WHERE p.id IN((payload->>'player1_id')::uuid,(payload->>'player2_id')::uuid) AND p.is_public)<>2 THEN RAISE EXCEPTION 'players unavailable' USING ERRCODE='42501'; END IF;
 INSERT INTO public.pairs(tournament_id,category_id,name,player1_id,player2_id,crest_url,seed,status)
 VALUES(tid,(payload->>'category_id')::uuid,btrim(payload->>'name'),(payload->>'player1_id')::uuid,(payload->>'player2_id')::uuid,payload->>'crest_url',(payload->>'seed')::integer,'confirmed') RETURNING * INTO pair;
 -- Explicit checks here: SECURITY DEFINER cannot rely on RLS.
 IF pair.category_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.tournament_categories c WHERE c.id=pair.category_id AND c.tournament_id=tid) THEN RAISE EXCEPTION 'category mismatch' USING ERRCODE='23514'; END IF;
 INSERT INTO public.tournament_entries(tournament_id,player_id) VALUES(tid,pair.player1_id),(tid,pair.player2_id) ON CONFLICT(tournament_id,player_id) DO NOTHING;
 result:=to_jsonb(pair);
 END IF;
 INSERT INTO private.entry_create_requests VALUES(actor,request_id,kind,jsonb_build_object('tid',tid,'data',payload),result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.create_entry_resource(uuid,uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_entry_resource(uuid,uuid,text,jsonb) TO authenticated;
-- Antes de despliegue: inventario real, reconciliación/precio individual, revisión
-- de política de borrado y E2E. Ninguna pareja/pago/nivel se infiere en autoinscripción.
ROLLBACK;
