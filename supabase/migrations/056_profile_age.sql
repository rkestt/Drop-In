-- 056_profile_age.sql
-- Chiude #97 (lane dati): Drop-In e' riservato a chi ha compiuto 14 anni,
-- blocco secco, eta' dichiarata come data di nascita.
--
-- Tabella separata `profile_age`, NON una colonna di `profiles`: quella ha
-- SELECT pubblica (nickname/avatar/karma leggibili da chiunque), e la data di
-- nascita non deve filtrare mai in mappa, ricerca o export altrui.
--
-- Contratto: assenza riga = non verificato = gate bloccante (la UI rimanda a
-- /verifica-eta). I ~30 utenti esistenti NON vengono backfillati: risultano
-- non verificati e passano dalla verifica alla prima azione protetta.
-- I CHECK sono il backstop del form (che nega prima, lato client): sotto i
-- 14 anni e oltre i 120 anni l'INSERT muore con 23514.
--
-- Nessuna funzione, nessun SECURITY DEFINER: solo tabella + policy, cosi'
-- `check:search-path` resta verde. Idempotente: IF NOT EXISTS / DROP IF
-- EXISTS + REVOKE/GRANT assoluti.

CREATE TABLE IF NOT EXISTS public.profile_age (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  birth_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Soglie sulla data civile di ROMA, non CURRENT_DATE: quello e' il fuso
  -- della sessione (UTC nel container Supabase), mentre il form ragiona a
  -- Europe/Rome (lib/profile/age.ts). Nelle 1-2h dopo mezzanotte UTC in cui
  -- a Roma e' gia' domani, CURRENT_DATE rifiuterebbe con 23514 un ragazzo
  -- che compie 14 anni proprio quel giorno, gia' accettato dal form.
  CHECK (birth_date <= ((now() AT TIME ZONE 'Europe/Rome')::date - INTERVAL '14 years')),
  CHECK (birth_date >= ((now() AT TIME ZONE 'Europe/Rome')::date - INTERVAL '120 years'))
);

ALTER TABLE public.profile_age ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profile_age_select ON public.profile_age;
CREATE POLICY profile_age_select ON public.profile_age
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS profile_age_insert ON public.profile_age;
CREATE POLICY profile_age_insert ON public.profile_age
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS profile_age_update ON public.profile_age;
CREATE POLICY profile_age_update ON public.profile_age
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Nessuna policy DELETE: la riga muore solo con l'account (ON DELETE CASCADE).
-- Modello 034/035: niente anon, authenticated solo own-row, tutto a service_role.
REVOKE ALL ON public.profile_age FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profile_age TO authenticated;
GRANT ALL ON public.profile_age TO service_role;
