-- 057_profile_age_rome_tz.sql
-- #97 (follow-up review): i CHECK della 056 usavano CURRENT_DATE, cioe' la
-- data civile del fuso di sessione (UTC nel container), mentre il form
-- ragiona a Europe/Rome. Nelle 1-2h dopo mezzanotte UTC in cui a Roma e'
-- gia' domani, il DB rifiutava (23514) un quattordicenne di giornata gia'
-- accettato dal form. Le soglie passano alla data di Roma, stessa del
-- predicato `isAtLeast14`.
--
-- Riparazione onesta, non edit silenzioso: la 056 era gia' applicata in
-- locale, quindi qui DROP + ADD espliciti (nomi auto-generati verificati sul
-- DB). La 056 nel repo e' aggiornata di conseguenza: chi parte da zero
-- (reset/staging/prod) crea gia' i CHECK giusti e questa 057 e' un no-op
-- di riallineamento. Nessuna funzione nuova: check:search-path resta verde.
-- Idempotente solo a vincoli presenti (migrazione una-tantum, non IF EXISTS:
-- se i nomi non tornano deve fallire forte, non passare in silenzio).

ALTER TABLE public.profile_age
  DROP CONSTRAINT profile_age_birth_date_check,
  DROP CONSTRAINT profile_age_birth_date_check1;

ALTER TABLE public.profile_age
  ADD CONSTRAINT profile_age_birth_date_check
    CHECK (birth_date <= ((now() AT TIME ZONE 'Europe/Rome')::date - INTERVAL '14 years')),
  ADD CONSTRAINT profile_age_birth_date_check1
    CHECK (birth_date >= ((now() AT TIME ZONE 'Europe/Rome')::date - INTERVAL '120 years'));
