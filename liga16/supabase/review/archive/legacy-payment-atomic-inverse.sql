-- REVIEW ONLY: inverse exact block, only BEFORE any committed payment operation.
-- After activity, preserve revision/receipts and use forward repair. Never erase audit.
BEGIN;
LOCK TABLE public.registrations IN ACCESS EXCLUSIVE MODE;
LOCK TABLE liga16_payment_private.requests IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM liga16_payment_private.requests) OR EXISTS(SELECT 1 FROM public.registrations WHERE payment_revision<>0) THEN
  RAISE EXCEPTION 'Hay operaciones o revisiones: conservar auditoría, requiere reparación hacia adelante';
 END IF;
END $$;
DROP FUNCTION public.record_registration_payment(uuid,integer,uuid,public.registration_status,public.payment_method,integer);
DROP TRIGGER liga16_payment_revision ON public.registrations;
DROP FUNCTION liga16_payment_private.bump_revision();
DROP TABLE liga16_payment_private.requests;
ALTER TABLE public.registrations DROP COLUMN payment_revision;
DROP SCHEMA liga16_payment_private;
-- Installed catalog snapshot had table-level ALL to anon/authenticated.
-- Revalidate original grants at execution; these only restore UPDATE revoked by forward.
GRANT UPDATE ON public.registrations TO anon,authenticated;
ROLLBACK; -- Deliberate review gate.
