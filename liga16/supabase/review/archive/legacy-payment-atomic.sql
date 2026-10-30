-- LOCAL REVIEW ONLY. Legacy individual registration, no conversion from pair fees.
-- Requires review with ownership migration. No production execution authorization.
BEGIN;
CREATE SCHEMA liga16_payment_private;
REVOKE ALL ON SCHEMA liga16_payment_private FROM PUBLIC,anon,authenticated;
ALTER TABLE public.registrations ADD COLUMN payment_revision integer NOT NULL DEFAULT 0;
CREATE TABLE liga16_payment_private.requests(
 actor_id uuid NOT NULL, request_id uuid NOT NULL, registration_id uuid NOT NULL REFERENCES public.registrations(id),
 expected_revision integer NOT NULL, payload jsonb NOT NULL, before_value jsonb NOT NULL, response jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor_id,request_id)
);
REVOKE ALL ON liga16_payment_private.requests FROM PUBLIC,anon,authenticated;
-- Every writer increments revision, even privileged maintenance outside the RPC.
CREATE FUNCTION liga16_payment_private.bump_revision() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN NEW.payment_revision:=OLD.payment_revision+1; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION liga16_payment_private.bump_revision() FROM PUBLIC;
CREATE TRIGGER liga16_payment_revision BEFORE UPDATE ON public.registrations FOR EACH ROW EXECUTE FUNCTION liga16_payment_private.bump_revision();
-- Mandatory RPC. There is no client fallback to UPDATE or optional CAS.
REVOKE UPDATE ON public.registrations FROM PUBLIC,anon,authenticated;
DO $$ BEGIN
 IF has_table_privilege('anon','public.registrations','UPDATE') OR has_table_privilege('authenticated','public.registrations','UPDATE') OR
 EXISTS(SELECT 1 FROM information_schema.column_privileges WHERE table_schema='public' AND table_name='registrations' AND privilege_type='UPDATE' AND grantee IN ('PUBLIC','anon','authenticated')) THEN
  RAISE EXCEPTION 'UPDATE sigue concedido por otra ruta; revisar grants antes de activar RPC';
 END IF;
END $$;
CREATE FUNCTION public.record_registration_payment(
 rid uuid, expected_revision integer, request_id uuid,
 next_status public.registration_status, method public.payment_method, amount integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); role_name text; prior public.registrations; result public.registrations;
 saved liga16_payment_private.requests; body jsonb:=jsonb_build_object('status',next_status,'method',method,'amount',amount);
BEGIN
 IF actor IS NULL OR request_id IS NULL OR expected_revision IS NULL THEN RAISE EXCEPTION 'Falta identidad, revisión o clave de operación' USING ERRCODE='22023'; END IF;
 SELECT raw_app_meta_data->>'role' INTO role_name FROM auth.users WHERE id=actor;
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||request_id::text,0));
 SELECT * INTO prior FROM public.registrations WHERE id=rid FOR UPDATE;
 IF NOT FOUND OR NOT (coalesce(role_name='admin',false) OR (coalesce(role_name='organizer',false) AND EXISTS(SELECT 1 FROM public.tournaments WHERE id=prior.tournament_id AND organizer_id=actor))) THEN
  RAISE EXCEPTION 'No tienes permiso para editar este pago' USING ERRCODE='42501';
 END IF;
 -- Serialize operation key even if accidentally reused against another registration.
 SELECT * INTO saved FROM liga16_payment_private.requests q WHERE q.actor_id=actor AND q.request_id=record_registration_payment.request_id;
 IF FOUND THEN
  IF saved.registration_id<>rid OR saved.expected_revision<>expected_revision OR saved.payload<>body THEN
   RAISE EXCEPTION 'La clave de operación ya se usó con otros datos' USING ERRCODE='22023';
  END IF;
  RETURN saved.response;
 END IF;
 IF prior.payment_revision<>expected_revision THEN RAISE EXCEPTION 'El pago cambió. Recarga y revisa antes de guardar' USING ERRCODE='40001'; END IF;
 IF next_status IS NULL OR method IS NULL OR amount<0 THEN RAISE EXCEPTION 'Pago inválido' USING ERRCODE='22023'; END IF;
 UPDATE public.registrations SET status=next_status,payment_method=method,amount_cents=amount,
 paid_at=CASE WHEN next_status='paid' THEN coalesce(prior.paid_at,now()) ELSE NULL END WHERE id=rid RETURNING * INTO result;
 INSERT INTO liga16_payment_private.requests(actor_id,request_id,registration_id,expected_revision,payload,before_value,response)
 VALUES(actor,request_id,rid,expected_revision,body,to_jsonb(prior),to_jsonb(result));
 RETURN to_jsonb(result);
END $$;
REVOKE ALL ON FUNCTION public.record_registration_payment(uuid,integer,uuid,public.registration_status,public.payment_method,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_registration_payment(uuid,integer,uuid,public.registration_status,public.payment_method,integer) TO authenticated;
ROLLBACK; -- Deliberate review gate.
