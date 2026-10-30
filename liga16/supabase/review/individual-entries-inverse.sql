-- REVIEW ONLY. Refuse destructive inverse after any individual signup or monetary activity.
BEGIN;
LOCK TABLE public.tournament_entries,public.entry_payments,private.entry_payment_audit,private.entry_payment_requests,private.entry_create_requests IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM private.entry_create_requests) OR EXISTS(SELECT 1 FROM public.tournament_entries) OR EXISTS(SELECT 1 FROM public.entry_payments)
 OR EXISTS(SELECT 1 FROM private.entry_payment_audit) OR EXISTS(SELECT 1 FROM private.entry_payment_requests) THEN
  RAISE EXCEPTION 'Inversa detenida: conservar inscripciones, pagos y recibos. Reparar hacia adelante.';
 END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.organizer_player(uuid,text) TO authenticated;
DROP FUNCTION public.create_entry_resource(uuid,uuid,text,jsonb);
DROP TABLE private.entry_create_requests;
DROP FUNCTION public.ensure_tournament_entry(uuid,uuid);
DROP FUNCTION public.enter_my_tournament(uuid);
DROP FUNCTION public.record_entry_payment(uuid,integer,uuid,text,text,integer);
DROP TABLE private.entry_payment_requests;
DROP TABLE private.entry_payment_audit;
DROP TABLE public.entry_payments;
DROP TRIGGER initialize_entry_payment ON public.tournament_entries;
DROP FUNCTION private.initialize_entry_payment();
DROP FUNCTION private.guard_entry_payment_identity();
DROP FUNCTION private.owns_entry(uuid);
DROP FUNCTION private.manages_entry(uuid);
DROP TABLE public.tournament_entries;
DROP FUNCTION private.guard_entry_identity();
ROLLBACK; -- Deliberate review gate.
