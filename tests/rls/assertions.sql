\set ON_ERROR_STOP on
-- Regression RLS/moderazione: un unico BEGIN ... ROLLBACK, nessun dato persiste.
-- I test negativi asseriscono lo SQLSTATE atteso (42501 = diniego di
-- autorizzazione, P0001 = validazione applicativa) e falliscono su qualunque
-- altro errore (funzione mancante, errore sbagliato) o se l'operazione riesce.
-- Nota sui claim: auth.uid()/auth.role() leggono il GUC request.jwt.claims, NON
-- il ROLE di sessione. Ogni blocco imposta entrambi; i blocchi anon azzerano i
-- claim (stringa vuota -> uid NULL), altrimenti i claim del blocco precedente
-- filtrerebbero e i test sarebbero vacui.
BEGIN;

-- ================= setup (come postgres: bypassa RLS, i trigger scattano) =================
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111','a@test.local'),
  ('22222222-2222-2222-2222-222222222222','b@test.local'),
  ('33333333-3333-3333-3333-333333333333','c@test.local');
-- handle_new_user ha gia' creato un profilo (is_moderator=false) per ciascuno:
-- NON inserirli a mano (profili doppi romperebbero i SELECT ... INTO dei trigger).
-- B diventa moderatore con claim service_role, altrimenti il guard su profiles
-- blocca anche il seed.
SET LOCAL request.jwt.claims = '{"role":"service_role"}';
UPDATE public.profiles SET is_moderator = true WHERE user_id = '22222222-2222-2222-2222-222222222222';

INSERT INTO public.courts (name, lat, lng, location, source, submitted_by, moderation_status, status)
VALUES ('Pending Court', 41.9, 12.5, ST_SetSRID(ST_MakePoint(12.5,41.9),4326)::geography, 'community',
        '11111111-1111-1111-1111-111111111111','pending','active');

-- ================= 1. anon non vede la pending (tabella + viewport) =================
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.courts WHERE moderation_status = 'pending') THEN
    RAISE EXCEPTION 'anon saw pending court via table';
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.courts_in_viewport(12.0,41.0,13.0,42.0) WHERE name = 'Pending Court') THEN
    RAISE EXCEPTION 'anon saw pending court via viewport';
  END IF;
END $$;
RESET ROLE;

-- ================= 2. C non vede la pending di A via tabella =================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.courts WHERE submitted_by = '11111111-1111-1111-1111-111111111111') THEN
    RAISE EXCEPTION 'user C saw pending court of user A via table';
  END IF;
END $$;
RESET ROLE;

-- ================= 3. C non vede la submission di A =================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.court_submissions WHERE submitter_id = '11111111-1111-1111-1111-111111111111') THEN
    RAISE EXCEPTION 'user C saw court_submissions row of user A';
  END IF;
END $$;
RESET ROLE;

-- ================= 4. A (non-mod) non approva -> 42501 =================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.approve_court((SELECT id FROM public.courts WHERE moderation_status = 'pending' LIMIT 1));
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'approve da non-mod: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'non-mod approved court';
END $$;
RESET ROLE;

-- ================= 5. A (non-mod) non rifiuta -> 42501 =================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.reject_court((SELECT id FROM public.courts WHERE moderation_status = 'pending' LIMIT 1), 'no');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'reject da non-mod: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'non-mod rejected court';
END $$;
RESET ROLE;

-- ================= 6. A (non-mod) non marca duplicati -> 42501 =================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.mark_duplicate(
      (SELECT id FROM public.courts WHERE moderation_status = 'pending' LIMIT 1),
      (SELECT id FROM public.courts WHERE moderation_status = 'approved' LIMIT 1));
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'mark_duplicate da non-mod: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'non-mod marked duplicate';
END $$;
RESET ROLE;

-- ================= 7. A non si auto-promuove -> 42501 =================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    UPDATE public.profiles SET is_moderator = true WHERE user_id = '11111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'self-promotion: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'self-promotion succeeded';
END $$;
RESET ROLE;

-- ================= 8. INSERT diretto su courts -> 42501 =================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    INSERT INTO public.courts (name, lat, lng, location) VALUES ('X',1.0,1.0,ST_SetSRID(ST_MakePoint(1.0,1.0),4326)::geography);
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'direct insert: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'direct insert succeeded';
END $$;
RESET ROLE;

-- ================= 9. UPDATE diretto su courts (anche propria pending) -> 42501 =================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    UPDATE public.courts SET name = 'Hacked' WHERE name = 'Pending Court';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'direct update: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'direct update succeeded';
END $$;
RESET ROLE;

-- ================= 10. DELETE diretto su courts -> 42501 =================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    DELETE FROM public.courts WHERE name = 'Pending Court';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'direct delete: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'direct delete succeeded';
END $$;
RESET ROLE;

-- ================= 11. terzo submit nelle 24h -> P0001 (quota giornaliera) =================
-- #84/055: 2 proposte di nuovi campi al giorno. Le prime due passano, la
-- terza viene fermata.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
SELECT public.submit_court('Test Court', 41.91, 12.51);
SELECT public.submit_court('Test Court 2', 41.92, 12.52);
DO $$
BEGIN
  BEGIN
    PERFORM public.submit_court('Test Court 3', 41.93, 12.53);
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'quota giornaliera: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'terzo submit nelle 24h riuscito';
END $$;
RESET ROLE;

-- ================= 12. submit con photo_path malevolo -> P0001 =================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.submit_court('Evil Photo', 41.93, 12.53, NULL, NULL,
      '33333333-3333-3333-3333-333333333333/../../x');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'photo_path malevolo: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'malicious photo_path accepted';
END $$;
RESET ROLE;

-- ================= 13. dedup_candidates da anon -> 42501 (grant solo authenticated) =================
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
DO $$
BEGIN
  BEGIN
    PERFORM public.dedup_candidates(41.9, 12.5, 3000);
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'dedup da anon: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'anon called dedup_candidates';
END $$;
RESET ROLE;

-- ================= 14. is_moderator(uuid altrui) da anon -> 42501 =================
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
DO $$
BEGIN
  BEGIN
    PERFORM public.is_moderator('11111111-1111-1111-1111-111111111111');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'is_moderator-oracolo: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'anon enumerated moderator status';
END $$;
RESET ROLE;

-- ================= 15. A vede le proprie pending NON mascherate =================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.dedup_candidates(41.9, 12.5, 3000)
                 WHERE name = 'Pending Court' AND id IS NOT NULL) THEN
    RAISE EXCEPTION 'owner cannot see own pending unmasked in dedup_candidates';
  END IF;
END $$;
RESET ROLE;

-- ================= 16. C vede le pending di A mascherate =================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.dedup_candidates(41.9, 12.5, 3000)
                 WHERE name = 'Proposta in attesa' AND id IS NULL) THEN
    RAISE EXCEPTION 'non-owner dedup row not masked';
  END IF;
  IF EXISTS (SELECT 1 FROM public.dedup_candidates(41.9, 12.5, 3000)
             WHERE name IN ('Pending Court', 'Test Court')) THEN
    RAISE EXCEPTION 'non-owner saw foreign pending name via dedup';
  END IF;
END $$;
RESET ROLE;

-- ================= 17. positivo: submit valido di C -> uuid =================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
DO $$
DECLARE v UUID;
BEGIN
  v := public.submit_court('C Court', 41.94, 12.54);
  IF v IS NULL THEN RAISE EXCEPTION 'submit returned null'; END IF;
END $$;
RESET ROLE;

-- ================= 18. positivo: B approva con nota; nota registrata =================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
SELECT public.approve_court((SELECT id FROM public.courts WHERE name = 'C Court'), 'sembra ok');
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courts WHERE name = 'C Court' AND moderation_status = 'approved') THEN
    RAISE EXCEPTION 'court not approved';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.court_submissions
                 WHERE raw_name = 'C Court' AND status = 'approved' AND moderation_note = 'sembra ok') THEN
    RAISE EXCEPTION 'moderation_note not recorded';
  END IF;
END $$;

-- ================= 19. approve su uuid inesistente -> P0001 =================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.approve_court('00000000-0000-0000-0000-000000000000');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'approve inesistente: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'approve of missing court silently succeeded';
END $$;
RESET ROLE;

-- ================= 20. mark_duplicate: self e target pending -> P0001; caso valido ok =================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
DO $$
DECLARE v_test UUID;
DECLARE v_unexpected BOOLEAN;
BEGIN
  v_test := (SELECT id FROM public.courts WHERE name = 'Test Court');
  v_unexpected := false;
  BEGIN
    PERFORM public.mark_duplicate(v_test, v_test);
    v_unexpected := true;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> 'P0001' THEN
      RAISE EXCEPTION 'mark_duplicate self: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
    END IF;
  END;
  IF v_unexpected THEN RAISE EXCEPTION 'self mark_duplicate succeeded'; END IF;
  v_unexpected := false;
  BEGIN
    PERFORM public.mark_duplicate(v_test, (SELECT id FROM public.courts WHERE name = 'Pending Court'));
    v_unexpected := true;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> 'P0001' THEN
      RAISE EXCEPTION 'mark_duplicate target pending: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
    END IF;
  END;
  IF v_unexpected THEN RAISE EXCEPTION 'mark_duplicate to pending target succeeded'; END IF;
  PERFORM public.mark_duplicate(v_test, (SELECT id FROM public.courts WHERE name = 'C Court'));
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courts c JOIN public.courts t ON c.duplicate_of = t.id
                 WHERE c.name = 'Test Court' AND c.moderation_status = 'duplicate'
                 AND t.name = 'C Court') THEN
    RAISE EXCEPTION 'valid mark_duplicate not applied';
  END IF;
END $$;

-- ================= 21. lobby su corte pending -> P0001 =================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    INSERT INTO public.lobbies (court_id, creator_id, start_time)
    VALUES ((SELECT id FROM public.courts WHERE name = 'Pending Court'),
            '11111111-1111-1111-1111-111111111111', now() + interval '1 hour');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'lobby su pending: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'lobby on pending court succeeded';
END $$;
RESET ROLE;

-- ================= 22. check-in su corte pending -> P0001 =================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    INSERT INTO public.check_ins (user_id, court_id, lat, lng)
    VALUES ('11111111-1111-1111-1111-111111111111',
            (SELECT id FROM public.courts WHERE name = 'Pending Court'), 41.9, 12.5);
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'check-in su pending: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'check-in on pending court succeeded';
END $$;
RESET ROLE;

-- ================= 23. positivo: lobby su corte approvata ok =================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
INSERT INTO public.lobbies (court_id, creator_id, start_time)
VALUES ((SELECT id FROM public.courts WHERE name = 'C Court'),
        '11111111-1111-1111-1111-111111111111', now() + interval '1 hour');
RESET ROLE;

-- ================= 24. positivo: anon vede la corte approvata (tabella + viewport) =================
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courts WHERE name = 'C Court') THEN
    RAISE EXCEPTION 'anon cannot see approved court via table';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.courts_in_viewport(12.53,41.93,12.55,41.95) WHERE name = 'C Court') THEN
    RAISE EXCEPTION 'anon cannot see approved court via viewport';
  END IF;
END $$;
RESET ROLE;

-- ================= 25. positivo: anon chiama le RPC di lettura =================
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
SELECT count(*) FROM public.courts_in_viewport(12.0,41.0,13.0,42.0);
SELECT count(*) FROM public.nearby_courts(41.9,12.5,5000,10);
DO $$ BEGIN
  IF public.is_moderator() THEN
    RAISE EXCEPTION 'anon reports as moderator';
  END IF;
END $$;
RESET ROLE;

-- ================= 26. foto freeze: approved immutabile, resto scrivibile =================
-- RLS che filtra le righe NON solleva 42501 su UPDATE/DELETE: le righe invisibili
-- danno semplicemente 0 righe interessate. Si asserisce l'effetto, non l'errore.
-- Seed come postgres (bypassa RLS); prove come authenticated con sub=uidA.
INSERT INTO public.courts (name, lat, lng, location, source, submitted_by, moderation_status, status, photo_path)
VALUES
  ('Photo Approved', 41.95, 12.55, ST_SetSRID(ST_MakePoint(12.55,41.95),4326)::geography, 'community',
   '11111111-1111-1111-1111-111111111111','approved','active','11111111-1111-1111-1111-111111111111/approved.jpg'),
  ('Photo Pending', 41.96, 12.56, ST_SetSRID(ST_MakePoint(12.56,41.96),4326)::geography, 'community',
   '11111111-1111-1111-1111-111111111111','pending','active','11111111-1111-1111-1111-111111111111/pending.jpg');
INSERT INTO storage.objects (id, bucket_id, name, owner, owner_id)
VALUES
  (gen_random_uuid(), 'court-photos', '11111111-1111-1111-1111-111111111111/approved.jpg',
   '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111'),
  (gen_random_uuid(), 'court-photos', '11111111-1111-1111-1111-111111111111/pending.jpg',
   '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111'),
  (gen_random_uuid(), 'court-photos', '11111111-1111-1111-1111-111111111111/orphan.jpg',
   '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111');

-- Il trigger storage.protect_objects_delete blocca QUALUNQUE delete diretto senza
-- questo GUC (anche a 0 righe: e' uno statement trigger). Va abilitato una volta
-- per la transazione, altrimenti anche i delete legittimi falliscono.
SET LOCAL "storage.allow_delete_query" = 'true';

-- 26a. DELETE su foto approved bloccato: la riga deve esistere ancora.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
DECLARE v_n INTEGER;
BEGIN
  DELETE FROM storage.objects WHERE name = '11111111-1111-1111-1111-111111111111/approved.jpg';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'delete su foto approved ha rimosso % righe', v_n;
  END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE name = '11111111-1111-1111-1111-111111111111/approved.jpg') THEN
    RAISE EXCEPTION 'foto approved sparita dopo delete bloccato';
  END IF;
END $$;

-- 26b. UPDATE su foto approved bloccato: zero righe modificate.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
DECLARE v_n INTEGER;
BEGIN
  UPDATE storage.objects SET updated_at = now()
  WHERE name = '11111111-1111-1111-1111-111111111111/approved.jpg';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'update su foto approved ha modificato % righe', v_n;
  END IF;
END $$;
RESET ROLE;

-- 26c. DELETE su foto pending (corte non approvata): deve riuscire.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DELETE FROM storage.objects WHERE name = '11111111-1111-1111-1111-111111111111/pending.jpg';
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM storage.objects WHERE name = '11111111-1111-1111-1111-111111111111/pending.jpg') THEN
    RAISE EXCEPTION 'delete su foto pending non riuscito';
  END IF;
END $$;

-- 26d. DELETE su path orfano (nessuna corte): deve riuscire.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DELETE FROM storage.objects WHERE name = '11111111-1111-1111-1111-111111111111/orphan.jpg';
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM storage.objects WHERE name = '11111111-1111-1111-1111-111111111111/orphan.jpg') THEN
    RAISE EXCEPTION 'delete su foto orfana non riuscito';
  END IF;
END $$;

-- 26e. service_role puo' sempre rimuovere una foto approved (intervento moderatore).
SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claims = '{"role":"service_role"}';
DELETE FROM storage.objects WHERE name = '11111111-1111-1111-1111-111111111111/approved.jpg';
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM storage.objects WHERE name = '11111111-1111-1111-1111-111111111111/approved.jpg') THEN
    RAISE EXCEPTION 'service_role non ha rimosso la foto approved';
  END IF;
END $$;

-- ================= 27. push_notifications read_at: solo proprie righe (d22) =================
INSERT INTO public.push_notifications (id, user_id, title, body, data)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','T','B','{"type":"karma_loss"}');

-- 27a. A aggiorna la propria riga (read_at): riesce.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
UPDATE public.push_notifications SET read_at = NOW() WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.push_notifications WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND read_at IS NOT NULL) THEN
    RAISE EXCEPTION 'own read_at update non riuscito';
  END IF;
END $$;

-- 27b. C non aggiorna la riga di A: 0 righe toccate, read_at invariato.
UPDATE public.push_notifications SET read_at = NULL WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
UPDATE public.push_notifications SET read_at = NOW() WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.push_notifications WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND read_at IS NOT NULL) THEN
    RAISE EXCEPTION 'user C ha aggiornato read_at della riga di A';
  END IF;
END $$;

-- 27c. anon non aggiorna: nessun privilegio (42501) prima ancora della RLS
-- (la 035 revoca ogni scrittura ad anon su push_notifications).
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
DO $$
BEGIN
  BEGIN
    UPDATE public.push_notifications SET read_at = NOW() WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'update anon su push_notifications: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'anon ha aggiornato read_at';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.push_notifications WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND read_at IS NOT NULL) THEN
    RAISE EXCEPTION 'anon ha aggiornato read_at';
  END IF;
END $$;

-- 27d. A non cambia title della propria riga (solo read_at) -> P0001.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    UPDATE public.push_notifications SET title = 'Hacked' WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'title update: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'title update riuscito (trigger mancante?)';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.push_notifications WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND title = 'T') THEN
    RAISE EXCEPTION 'title cambiato nonostante il trigger';
  END IF;
END $$;

-- 27e. A non riassegna la riga a un altro utente -> P0001 (trigger) o 0 righe.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    UPDATE public.push_notifications SET user_id = '33333333-3333-3333-3333-333333333333' WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'user_id update: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'user_id update riuscito (trigger/policy mancanti?)';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.push_notifications WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND user_id = '11111111-1111-1111-1111-111111111111') THEN
    RAISE EXCEPTION 'riga riassegnata a un altro utente';
  END IF;
END $$;

-- ================= 28. #54: pending altrui interamente mascherata in dedup =================
-- Come C (non proprietario): la riga mascherata non espone coordinate,
-- distanza, stato o origine; il nome reale non filtra mai.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.dedup_candidates(41.9, 12.5, 3000)
             WHERE name IN ('Pending Court', 'Test Court')) THEN
    RAISE EXCEPTION 'non-owner saw foreign pending real name';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dedup_candidates(41.9, 12.5, 3000)
                 WHERE name = 'Proposta in attesa') THEN
    RAISE EXCEPTION 'masked row missing for non-owner';
  END IF;
  IF EXISTS (SELECT 1 FROM public.dedup_candidates(41.9, 12.5, 3000)
             WHERE name = 'Proposta in attesa'
               AND (id IS NOT NULL OR lat IS NOT NULL OR lng IS NOT NULL
                    OR distance_m IS NOT NULL OR moderation_status IS NOT NULL
                    OR source IS NOT NULL)) THEN
    RAISE EXCEPTION 'masked row leaks coordinates/distance/status/source';
  END IF;
END $$;
RESET ROLE;

-- Controllo positivo: il proprietario vede la propria pending per esteso.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.dedup_candidates(41.9, 12.5, 3000)
                 WHERE name = 'Pending Court' AND id IS NOT NULL
                   AND lat IS NOT NULL AND lng IS NOT NULL
                   AND moderation_status = 'pending') THEN
    RAISE EXCEPTION 'owner lost unmasked view of own pending';
  END IF;
END $$;
RESET ROLE;

-- ================= 29. #57: UPDATE di court_id su pending -> P0001 =================
-- Il creatore sposta la propria lobby (creata al punto 23 su 'C Court',
-- approvata) verso 'Pending Court': il trigger BEFORE UPDATE OF court_id
-- blocca. Stesso per un check-in proprio su corte approvata (inserito qui
-- sulle coordinate esatte della corte per passare il controllo distanza,
-- INSERT-only). Accettati P0001 (trigger) o 42501 (RLS): cio' che conta e'
-- che lo spostamento non riesca.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
INSERT INTO public.check_ins (user_id, court_id, lat, lng)
VALUES ('11111111-1111-1111-1111-111111111111',
        (SELECT id FROM public.courts WHERE name = 'C Court'), 41.94, 12.54);
DO $$
BEGIN
  BEGIN
    UPDATE public.lobbies SET court_id = (SELECT id FROM public.courts WHERE name = 'Pending Court')
    WHERE creator_id = '11111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE IN ('42501', 'P0001') THEN RETURN; END IF;
    RAISE EXCEPTION 'lobby move su pending: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'lobby moved onto pending court';
END $$;
DO $$
BEGIN
  BEGIN
    UPDATE public.check_ins SET court_id = (SELECT id FROM public.courts WHERE name = 'Pending Court')
    WHERE user_id = '11111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE IN ('42501', 'P0001') THEN RETURN; END IF;
    RAISE EXCEPTION 'check-in move su pending: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'check-in moved onto pending court';
END $$;
-- Controlli positivi: stesso trigger non blocca gli UPDATE leciti.
UPDATE public.lobbies SET max_players = 12
WHERE creator_id = '11111111-1111-1111-1111-111111111111';
UPDATE public.lobbies SET court_id = (SELECT id FROM public.courts WHERE name = 'Photo Approved')
WHERE creator_id = '11111111-1111-1111-1111-111111111111';
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.lobbies l JOIN public.courts c ON c.id = l.court_id
                 WHERE l.creator_id = '11111111-1111-1111-1111-111111111111'
                   AND c.name = 'Photo Approved' AND l.max_players = 12) THEN
    RAISE EXCEPTION 'lecit lobby update blocked by court_id guard';
  END IF;
END $$;

-- ================= 30. #61: courts_in_viewport espone solo le colonne scelte =================
-- Uguaglianza esatta sull'elenco dei parametri OUT/TABLE: niente location,
-- submitted_by, osm_id, duplicate_of, created_at/updated_at, e nessuna
-- futura colonna sensibile finita dentro per sbaglio via SELECT *.
-- (#106 aggiunge in coda is_auto_name: aggiornamento intenzionale, non leak.)
DO $$ DECLARE v TEXT[]; BEGIN
  SELECT COALESCE(array_agg(u.name ORDER BY u.ord), '{}') INTO v
  FROM pg_proc p
  JOIN LATERAL unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS u(name, mode, ord) ON true
  WHERE p.pronamespace = 'public'::regnamespace
    AND p.proname = 'courts_in_viewport'
    AND u.mode IN ('o', 'b', 't');
  IF v <> ARRAY['id','name','lat','lng','address','surface_type','hoop_count',
                'status','sport','venue_type','source','photo_path','moderation_status',
                'is_auto_name'] THEN
    RAISE EXCEPTION 'courts_in_viewport columns changed: %', v;
  END IF;
END $$;

-- ================= 31. #60: p_query con '%' non fa da wildcard =================
-- Come anon: '%' e '_' letterali non matchano nulla (nessuna corte li
-- contiene); la ricerca normale continua a funzionare.
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
DO $$ DECLARE v_n BIGINT; BEGIN
  SELECT count(*) INTO v_n FROM public.nearby_courts(41.9, 12.5, 50000, 10, NULL, '%');
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'p_query %% acted as wildcard: % rows', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM public.nearby_courts(41.9, 12.5, 50000, 10, NULL, '_');
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'p_query _ acted as wildcard: % rows', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM public.nearby_courts(41.9, 12.5, 50000, 10, NULL, 'C Court');
  IF v_n < 1 THEN
    RAISE EXCEPTION 'plain p_query stopped matching';
  END IF;
END $$;
RESET ROLE;

-- ================= 32. #59: deny di default senza claim JWT (tripwire per IS DISTINCT FROM) =================
-- Senza claim JWT auth.role() è NULL: con `<>` il confronto è NULL e la
-- guardia lascia passare, con `IS DISTINCT FROM` nega con 42501. Se la 018
-- venisse revertata a `<>`, questo blocco (e non il resto della suite)
-- fallirebbe con 'approve senza claim riuscita'.
SET LOCAL request.jwt.claims = '';
DO $$
BEGIN
  BEGIN
    PERFORM public.approve_court((SELECT id FROM public.courts WHERE name = 'Pending Court'));
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'approve senza claim: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'approve senza claim riuscita (guardia NULL-opaca?)';
END $$;
RESET ROLE;


-- ================= 33. #22: user_favorites, righe proprie + approved-only =================
-- Fixture riusati: 'C Court' (approved, blocco 18) e 'Pending Court'
-- (pending di A, setup). A = 1111…, B = 2222… (moderatore), C = 3333….

-- Pulizia difensiva: se una run precedente ha lasciato righe committate (una
-- verifica interrotta prima del ROLLBACK), questo blocco diventerebbe
-- dipendente dallo stato del database. Si riparte da zero come postgres.
DELETE FROM public.user_favorites;

-- (a) anon SELECT -> 42501 (nessun grant ad anon, per spec) oppure 0 righe.
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
DO $$ DECLARE v_n BIGINT; BEGIN
  BEGIN
    SELECT count(*) INTO v_n FROM public.user_favorites;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'anon select: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'anon saw % favorite rows', v_n;
  END IF;
END $$;
RESET ROLE;

-- (b) A salva un campo approved -> ok.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
INSERT INTO public.user_favorites (user_id, court_id)
VALUES ('11111111-1111-1111-1111-111111111111',
        (SELECT id FROM public.courts WHERE name = 'C Court'));
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_favorites
                 WHERE user_id = '11111111-1111-1111-1111-111111111111') THEN
    RAISE EXCEPTION 'A favorite insert did not persist';
  END IF;
END $$;

-- (c) B vede 0 righe dei preferiti di A.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
DO $$ DECLARE v_n BIGINT; BEGIN
  SELECT count(*) INTO v_n FROM public.user_favorites;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'B saw % favorite rows of A', v_n;
  END IF;
END $$;
RESET ROLE;

-- (d) B cancella la riga di A -> 0 righe cancellate, A ne ha ancora 1.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
DO $$ DECLARE v_n BIGINT; BEGIN
  DELETE FROM public.user_favorites
  WHERE user_id = '11111111-1111-1111-1111-111111111111';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'B deleted % rows of A favorites', v_n;
  END IF;
END $$;
RESET ROLE;
DO $$ DECLARE v_n BIGINT; BEGIN
  SELECT count(*) INTO v_n FROM public.user_favorites
  WHERE user_id = '11111111-1111-1111-1111-111111111111';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'A favorites count after B delete: % (want 1)', v_n;
  END IF;
END $$;

-- (e) A salva la pending 'Pending Court' -> 42501 (WITH CHECK fallita).
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    INSERT INTO public.user_favorites (user_id, court_id)
    VALUES ('11111111-1111-1111-1111-111111111111',
            (SELECT id FROM public.courts WHERE name = 'Pending Court'));
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'favorite su pending: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'favorite su pending court riuscita';
END $$;
RESET ROLE;

-- (f) A cancella il proprio preferito -> ok, 0 righe restanti.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DELETE FROM public.user_favorites
WHERE user_id = '11111111-1111-1111-1111-111111111111';
RESET ROLE;
DO $$ DECLARE v_n BIGINT; BEGIN
  SELECT count(*) INTO v_n FROM public.user_favorites;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'favorites not empty after A delete: %', v_n;
  END IF;
END $$;

-- ================= 34. #27: bucket avatars isolato per proprietario =================
-- Come SET LOCAL ROLE / claim: vedi blocchi sopra (auth.uid() legge il GUC
-- request.jwt.claims, non il ROLE di sessione).
-- Seed come postgres (bypassa RLS).
UPDATE public.profiles SET avatar_url = 'https://ref.test/storage/v1/object/public/avatars/11111111-1111-1111-1111-111111111111/avatar-a.jpg'
WHERE user_id = '11111111-1111-1111-1111-111111111111';

-- Il trigger storage.protect_objects_delete blocca QUALUNQUE delete diretto
-- senza questo GUC (anche a 0 righe). Già abilitato al punto 26 per la
-- transazione, lo si riafferma per leggibilità locale del blocco.
SET LOCAL "storage.allow_delete_query" = 'true';

-- 34a. positivo: A inserisce sotto il proprio prefisso.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
INSERT INTO storage.objects (id, bucket_id, name, owner, owner_id)
VALUES (gen_random_uuid(), 'avatars', '11111111-1111-1111-1111-111111111111/avatar-a.jpg',
        '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111');
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE name = '11111111-1111-1111-1111-111111111111/avatar-a.jpg') THEN
    RAISE EXCEPTION 'insert avatar proprio prefisso non riuscito';
  END IF;
END $$;

-- 34b. A non inserisce sotto il prefisso di B -> 42501.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    INSERT INTO storage.objects (id, bucket_id, name, owner, owner_id)
    VALUES (gen_random_uuid(), 'avatars', '22222222-2222-2222-2222-222222222222/avatar-evil.jpg',
            '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'insert avatar altrui: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'insert avatar sotto prefisso altrui riuscito';
END $$;
RESET ROLE;

-- 34c. B non aggiorna né cancella l'oggetto di A: 0 righe, l'oggetto resta.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
DO $$
DECLARE v_n INTEGER;
BEGIN
  UPDATE storage.objects SET updated_at = now()
  WHERE name = '11111111-1111-1111-1111-111111111111/avatar-a.jpg';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'update avatar altrui ha modificato % righe', v_n;
  END IF;
  DELETE FROM storage.objects
  WHERE name = '11111111-1111-1111-1111-111111111111/avatar-a.jpg';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'delete avatar altrui ha rimosso % righe', v_n;
  END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM storage.objects WHERE name = '11111111-1111-1111-1111-111111111111/avatar-a.jpg') <> 1 THEN
    RAISE EXCEPTION 'oggetto avatar di A alterato da B';
  END IF;
END $$;

-- 34d. anon legge l'oggetto (bucket pubblico).
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE name = '11111111-1111-1111-1111-111111111111/avatar-a.jpg') THEN
    RAISE EXCEPTION 'anon non vede avatar pubblico';
  END IF;
END $$;
RESET ROLE;

-- 34e. B non cambia l'avatar_url di A: 0 righe, valore invariato.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
UPDATE public.profiles SET avatar_url = 'https://evil.example/x.jpg'
WHERE user_id = '11111111-1111-1111-1111-111111111111';
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles
                 WHERE user_id = '11111111-1111-1111-1111-111111111111'
                 AND avatar_url = 'https://ref.test/storage/v1/object/public/avatars/11111111-1111-1111-1111-111111111111/avatar-a.jpg') THEN
    RAISE EXCEPTION 'avatar_url di A cambiato da B';
  END IF;
END $$;

-- ================= 35. #71/#72: sport NULL visibile con qualunque filtro sport =================
-- Decisione prodotto: NULL = "sport non specificato", matcha ogni filtro sport
-- (default temporaneo in attesa del backfill #63). Copre le tre RPC di lettura:
-- nearby_courts, open_lobbies, courts_in_viewport.
-- Seed come postgres (bypassa RLS, ruolo corrente dopo il RESET ROLE del
-- blocco 32); verifiche come anon con claim azzerati, stile dei blocchi sopra.
INSERT INTO public.courts (name, lat, lng, location, source, submitted_by, moderation_status, status, sport)
VALUES ('Null Sport Court', 41.905, 12.505, ST_SetSRID(ST_MakePoint(12.505,41.905),4326)::geography, 'community',
        '11111111-1111-1111-1111-111111111111','approved','active',NULL);
INSERT INTO public.lobbies (court_id, creator_id, start_time)
VALUES ((SELECT id FROM public.courts WHERE name = 'Null Sport Court'),
        '11111111-1111-1111-1111-111111111111', now() + interval '1 hour');

-- 35a. nearby_courts con filtro sport trova la corte con sport NULL.
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.nearby_courts(41.9,12.5,50000,200,'basketball',NULL) WHERE name = 'Null Sport Court') THEN
    RAISE EXCEPTION 'nearby_courts(basketball) hides NULL-sport court (#71)';
  END IF;
END $$;
RESET ROLE;

-- 35b. open_lobbies con filtro sport trova la lobby sulla corte con sport NULL.
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.open_lobbies('basketball', 20, 41.9, 12.5, 50000) WHERE court_name = 'Null Sport Court') THEN
    RAISE EXCEPTION 'open_lobbies(basketball) hides lobby on NULL-sport court (#71)';
  END IF;
END $$;
RESET ROLE;

-- 35c. courts_in_viewport con filtro sport trova la corte con sport NULL.
-- Bbox stretta sulla corte: la funzione non ha ORDER BY e taglia a LIMIT
-- max_results, quindi su bbox ampie e dati densi la riga puo' restare fuori
-- dal taglio per motivi non legati al predicato sport (su staging Roma la
-- bbox (12.0,41.0,13.0,42.0) supera gia' le 2000 righe).
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courts_in_viewport(12.50,41.90,12.51,41.91,2000,'basketball') WHERE name = 'Null Sport Court') THEN
    RAISE EXCEPTION 'courts_in_viewport(basketball) hides NULL-sport court (#71)';
  END IF;
END $$;
RESET ROLE;

-- ================= 36. #58: ritiro/modifica proposta pending =================
-- Ultimo blocco: dopo (d) 'Pending Court' diventa 'Pending Court 2' e dopo
-- (e) sparisce del tutto. Nessun blocco precedente dipende da questi nomi
-- oltre il punto 32, e nulla segue: la cancellazione finale e' sicura.
-- Setup: la fixture 'Pending Court' nasce senza riga di audit (insert
-- diretto come postgres), quindi la si crea qui per asserire raw_name e
-- cascade del ritiro.
INSERT INTO public.court_submissions (court_id, submitter_id, raw_name, lat, lng, status)
VALUES ((SELECT id FROM public.courts WHERE name = 'Pending Court'),
        '11111111-1111-1111-1111-111111111111', 'Pending Court', 41.9, 12.5, 'pending');

-- 36a. C ritira la pending di A -> 42501.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.retract_submission((SELECT id FROM public.courts WHERE name = 'Pending Court'));
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'retract altrui: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'retract di proposta altrui riuscito';
END $$;
RESET ROLE;

-- 36b. C modifica la pending di A -> 42501.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.update_pending_submission(
      (SELECT id FROM public.courts WHERE name = 'Pending Court'), 'Hacked', 'padel', 'asphalt');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'update altrui: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'update di proposta altrui riuscito';
END $$;
RESET ROLE;

-- 36c. A ritira una corte approvata (propria ma non pending) -> 42501.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.retract_submission((SELECT id FROM public.courts WHERE name = 'Photo Approved'));
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'retract approved: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'retract di corte approvata riuscito';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courts WHERE name = 'Photo Approved') THEN
    RAISE EXCEPTION 'corte approvata sparita dopo retract negato';
  END IF;
END $$;

-- 36d. positivo: A modifica la propria pending (stato invariato, audit aggiornato).
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
SELECT public.update_pending_submission(
  (SELECT id FROM public.courts WHERE name = 'Pending Court'), 'Pending Court 2', 'padel', 'asphalt');
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courts
                 WHERE name = 'Pending Court 2' AND sport = 'padel'
                   AND surface_type = 'asphalt' AND moderation_status = 'pending') THEN
    RAISE EXCEPTION 'update_pending_submission non applicato o stato toccato';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.court_submissions
                 WHERE raw_name = 'Pending Court 2' AND status = 'pending') THEN
    RAISE EXCEPTION 'court_submissions.raw_name non aggiornato';
  END IF;
END $$;

-- 36e. positivo: A ritira la propria pending (corte + submission sparite).
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
SELECT public.retract_submission((SELECT id FROM public.courts WHERE name = 'Pending Court 2'));
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.courts WHERE name = 'Pending Court 2') THEN
    RAISE EXCEPTION 'corte ritirata ancora presente';
  END IF;
  IF EXISTS (SELECT 1 FROM public.court_submissions WHERE raw_name = 'Pending Court 2') THEN
    RAISE EXCEPTION 'submission orfana dopo il ritiro (manca cascade)';
  END IF;
END $$;

-- 36f. A non ritira la propria pending con lobby collegata -> 42501.
-- Fixture dedicata e autodistrutta qui (dopo la 36e, cosi' l'ordine non
-- conta): la corte nasce approvata per creare la lobby (il guard
-- require_approved_court passa), poi torna pending; il ritiro deve negare
-- invece di cascare su lobby/partecipanti/check-in/preferiti.
INSERT INTO public.courts (name, lat, lng, location, source, submitted_by, moderation_status, status)
VALUES ('Retract Lobby Court', 41.91, 12.51, ST_SetSRID(ST_MakePoint(12.51,41.91),4326)::geography, 'community',
        '11111111-1111-1111-1111-111111111111','approved','active');
INSERT INTO public.court_submissions (court_id, submitter_id, raw_name, lat, lng, status)
VALUES ((SELECT id FROM public.courts WHERE name = 'Retract Lobby Court'),
        '11111111-1111-1111-1111-111111111111', 'Retract Lobby Court', 41.91, 12.51, 'pending');
INSERT INTO public.lobbies (court_id, creator_id, start_time)
VALUES ((SELECT id FROM public.courts WHERE name = 'Retract Lobby Court'),
        '11111111-1111-1111-1111-111111111111', now() + interval '1 hour');
UPDATE public.courts SET moderation_status = 'pending' WHERE name = 'Retract Lobby Court';
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.retract_submission((SELECT id FROM public.courts WHERE name = 'Retract Lobby Court'));
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'retract con lobby: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'retract con lobby collegate riuscito (cascata distruttiva)';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courts WHERE name = 'Retract Lobby Court') THEN
    RAISE EXCEPTION 'corte sparita nonostante il retract negato';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lobbies l JOIN public.courts c ON c.id = l.court_id
                 WHERE c.name = 'Retract Lobby Court') THEN
    RAISE EXCEPTION 'lobby sparita nonostante il retract negato';
  END IF;
END $$;
DELETE FROM public.lobbies WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Retract Lobby Court');
DELETE FROM public.courts WHERE name = 'Retract Lobby Court';

-- ================= 37. #26: check_ins, A vede le proprie; policy SELECT pubblica =================
-- La policy SELECT su check_ins e' USING (true) ("Check-ins are viewable by
-- everyone", 001_initial_schema.sql): NON c'e' isolamento RLS per utente.
-- La pagina profilo si affida quindi al filtro applicativo
-- `.eq("user_id", userId)`: questo blocco fissa il comportamento reale
-- (A vede le proprie righe; C vede anche quelle di A) cosi' che una futura
-- restrizione della policy emerga qui come regressione.
-- Seed come postgres (bypassa RLS, i trigger scattano): corte approvata
-- mai usata da A (evita il cooldown 5min di block 29) con le sue
-- coordinate esatte (controllo distanza 50m).
INSERT INTO public.check_ins (user_id, court_id, lat, lng)
SELECT '11111111-1111-1111-1111-111111111111', id, lat, lng
FROM public.courts WHERE name = 'Photo Approved' LIMIT 1;

-- (a) A vede le proprie righe filtrate per user_id.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$ DECLARE v_n BIGINT; BEGIN
  SELECT count(*) INTO v_n FROM public.check_ins
  WHERE user_id = '11111111-1111-1111-1111-111111111111';
  IF v_n < 1 THEN
    RAISE EXCEPTION 'A non vede i propri check-in (% righe)', v_n;
  END IF;
END $$;
RESET ROLE;

-- (b) C vede le righe di A (policy pubblica): il filtro applicativo resta obbligatorio.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
DO $$ DECLARE v_n BIGINT; BEGIN
  SELECT count(*) INTO v_n FROM public.check_ins
  WHERE user_id = '11111111-1111-1111-1111-111111111111';
  IF v_n < 1 THEN
    RAISE EXCEPTION 'policy check_ins cambiata? C non vede piu le righe di A (% righe)', v_n;
  END IF;
END $$;
RESET ROLE;

-- ================= 38. #91/038: il -3 scatta solo per i riconfermati senza check-in =================
-- Migrazione B (038): `reconfirmed_at IS NOT NULL AND NOT EXISTS (check-in
-- attivo con lobby_id = NEW.id)`. La fixture riconferma C all'INSERT
-- (l'UPDATE diretto passa dal guard della 037 e qui la lobby e' gia'
-- iniziata, fuori finestra); B resta iscritto senza riconferma. Due casi:
-- C senza check-in -> -3 e una sola riga karma_loss; B -> karma invariato,
-- zero righe.
DO $$
DECLARE
  v_court UUID;
  v_lobby UUID;
  v_before_c INTEGER;
  v_after_c INTEGER;
  v_before_b INTEGER;
  v_after_b INTEGER;
  v_note_count BIGINT;
BEGIN
  INSERT INTO public.courts (name, lat, lng, location, source, submitted_by, moderation_status, status, sport)
  VALUES ('Karma Court', 41.905, 12.505,
          ST_SetSRID(ST_MakePoint(12.505, 41.905), 4326)::geography,
          'community', '33333333-3333-3333-3333-333333333333', 'approved', 'active', NULL)
  RETURNING id INTO v_court;

  INSERT INTO public.lobbies (court_id, creator_id, start_time, max_players, status)
  VALUES (v_court, '33333333-3333-3333-3333-333333333333', now() - interval '3 hours', 10, 'open')
  RETURNING id INTO v_lobby;

  INSERT INTO public.lobby_participants (lobby_id, user_id, reconfirmed_at)
  VALUES (v_lobby, '33333333-3333-3333-3333-333333333333', now() - interval '3 hours'),
         (v_lobby, '22222222-2222-2222-2222-222222222222', NULL);

  SELECT karma_score INTO v_before_c FROM public.profiles
  WHERE user_id = '33333333-3333-3333-3333-333333333333';
  SELECT karma_score INTO v_before_b FROM public.profiles
  WHERE user_id = '22222222-2222-2222-2222-222222222222';

  UPDATE public.lobbies SET status = 'closed' WHERE id = v_lobby;

  SELECT karma_score INTO v_after_c FROM public.profiles
  WHERE user_id = '33333333-3333-3333-3333-333333333333';
  IF v_after_c <> v_before_c - 3 THEN
    RAISE EXCEPTION 'karma riconfermato dopo la chiusura: % -> % (atteso -3)', v_before_c, v_after_c;
  END IF;

  SELECT karma_score INTO v_after_b FROM public.profiles
  WHERE user_id = '22222222-2222-2222-2222-222222222222';
  IF v_after_b <> v_before_b THEN
    RAISE EXCEPTION 'karma non riconfermato dopo la chiusura: % -> % (atteso invariato)', v_before_b, v_after_b;
  END IF;

  SELECT count(*) INTO v_note_count
  FROM public.push_notifications
  WHERE user_id = '33333333-3333-3333-3333-333333333333'
    AND data->>'type' = 'karma_loss'
    AND (data->>'lobby_id')::uuid = v_lobby;
  IF v_note_count <> 1 THEN
    RAISE EXCEPTION 'notifiche karma_loss per la lobby: % (atteso 1)', v_note_count;
  END IF;

  IF EXISTS (SELECT 1 FROM public.push_notifications
             WHERE user_id = '22222222-2222-2222-2222-222222222222'
               AND data->>'type' = 'karma_loss'
               AND (data->>'lobby_id')::uuid = v_lobby) THEN
    RAISE EXCEPTION 'notifica karma_loss al non riconfermato';
  END IF;
END $$;

-- ================= 39. guard self-service profili (028) =================
-- La policy UPDATE su profiles e' own-row senza restrizioni di colonna: il
-- trigger guard_profile_self_service nega con 42501 il self-karma, il
-- self-unban e l'avatar fuori prefisso, mentre lascia passare le scritture
-- interne dei trigger karma/ban (pg_trigger_depth() > 1), il seed senza
-- claim e service_role.
-- Setup come postgres con claim service_role (stile setup iniziale): ban
-- attivo su A cosi' (b) e' un vero self-unban, karma noto a 90 per (f)/(g).
SET LOCAL request.jwt.claims = '{"role":"service_role"}';
UPDATE public.profiles SET banned_until = now() + interval '1 day', karma_score = 90
WHERE user_id = '11111111-1111-1111-1111-111111111111';

-- 39a. A non si alza il karma -> 42501, valore invariato.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    UPDATE public.profiles SET karma_score = 100 WHERE user_id = '11111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'karma self-grant: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'karma self-grant riuscito';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles
                 WHERE user_id = '11111111-1111-1111-1111-111111111111' AND karma_score = 90) THEN
    RAISE EXCEPTION 'karma di A alterato nonostante il guard';
  END IF;
END $$;

-- 39b. A non si toglie il ban -> 42501, ban invariato.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    UPDATE public.profiles SET banned_until = NULL WHERE user_id = '11111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'self-unban: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'self-unban riuscito';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles
                 WHERE user_id = '11111111-1111-1111-1111-111111111111' AND banned_until IS NOT NULL) THEN
    RAISE EXCEPTION 'ban di A rimosso nonostante il guard';
  END IF;
END $$;

-- 39c. positivo: A cambia il nickname -> riesce.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
UPDATE public.profiles SET nickname = 'x' WHERE user_id = '11111111-1111-1111-1111-111111111111';
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles
                 WHERE user_id = '11111111-1111-1111-1111-111111111111' AND nickname = 'x') THEN
    RAISE EXCEPTION 'nickname lecito bloccato dal guard';
  END IF;
END $$;

-- 39d. positivo: avatar_url bare path proprio -> riesce.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
UPDATE public.profiles SET avatar_url = '11111111-1111-1111-1111-111111111111/a.jpg'
WHERE user_id = '11111111-1111-1111-1111-111111111111';
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles
                 WHERE user_id = '11111111-1111-1111-1111-111111111111'
                 AND avatar_url = '11111111-1111-1111-1111-111111111111/a.jpg') THEN
    RAISE EXCEPTION 'avatar proprio bloccato dal guard';
  END IF;
END $$;

-- 39e. avatar_url sotto il prefisso di B -> 42501, valore invariato.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    UPDATE public.profiles SET avatar_url = '22222222-2222-2222-2222-222222222222/b.jpg'
    WHERE user_id = '11111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'avatar altrui: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'avatar sotto prefisso altrui riuscito';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles
                 WHERE user_id = '11111111-1111-1111-1111-111111111111'
                 AND avatar_url = '11111111-1111-1111-1111-111111111111/a.jpg') THEN
    RAISE EXCEPTION 'avatar_url di A alterato con prefisso altrui';
  END IF;
END $$;

-- 39f. via interna ok: check-in con claim di A (ruolo postgres) alza il
-- karma di 1 — prova che pg_trigger_depth() > 1 lascia passare
-- increment_karma_on_check_in. Corte nuova approvata: niente cooldown 5min
-- e distanza 0 (stesse coordinate della corte).
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
DECLARE
  v_before INTEGER;
  v_after INTEGER;
  v_court UUID;
BEGIN
  SELECT karma_score INTO v_before FROM public.profiles
  WHERE user_id = '11111111-1111-1111-1111-111111111111';
  INSERT INTO public.courts (name, lat, lng, location, source, submitted_by, moderation_status, status)
  VALUES ('Guard Karma Court', 41.9, 12.5, ST_SetSRID(ST_MakePoint(12.5,41.9),4326)::geography, 'community',
          '11111111-1111-1111-1111-111111111111','approved','active')
  RETURNING id INTO v_court;
  INSERT INTO public.check_ins (user_id, court_id, lat, lng)
  VALUES ('11111111-1111-1111-1111-111111111111', v_court, 41.9, 12.5);
  SELECT karma_score INTO v_after FROM public.profiles
  WHERE user_id = '11111111-1111-1111-1111-111111111111';
  IF v_after <> v_before + 1 THEN
    RAISE EXCEPTION 'karma via interna: % -> % (atteso +1)', v_before, v_after;
  END IF;
END $$;

-- 39g. positivo: con claim service_role il karma si aggiorna -> riesce.
SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claims = '{"role":"service_role"}';
DO $$
DECLARE
  v_before INTEGER;
  v_after INTEGER;
BEGIN
  SELECT karma_score INTO v_before FROM public.profiles
  WHERE user_id = '11111111-1111-1111-1111-111111111111';
  UPDATE public.profiles SET karma_score = karma_score + 5
  WHERE user_id = '11111111-1111-1111-1111-111111111111';
  SELECT karma_score INTO v_after FROM public.profiles
  WHERE user_id = '11111111-1111-1111-1111-111111111111';
  IF v_after <> v_before + 5 THEN
    RAISE EXCEPTION 'service_role: karma % -> % (atteso +5)', v_before, v_after;
  END IF;
END $$;
RESET ROLE;


-- ================= 40. #25/029: marcatori di delivery push solo service_role =================
-- La 016 lasciava modificabile solo `read_at`, anche per service_role: la
-- Edge Function non avrebbe potuto marcare l'invio. La 029 apre i soli
-- `push_sent_at`/`push_attempts`/`push_failed_at` a service_role e lascia
-- `read_at` all'utente. Questo blocco fissa il confine.
INSERT INTO public.push_notifications (user_id, title, body, data)
VALUES ('11111111-1111-1111-1111-111111111111', 'Push test', 'corpo', '{"type":"lobby"}'::jsonb);

-- 40a. Utente: non puo' marcare l'invio -> P0001.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    UPDATE public.push_notifications SET push_sent_at = now()
    WHERE user_id = '11111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'push_sent_at da utente: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'utente ha marcato push_sent_at';
END $$;
RESET ROLE;

-- 40b. Utente: read_at resta modificabile (nessuna regressione dalla 016).
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
DECLARE v_n INTEGER;
BEGIN
  UPDATE public.push_notifications SET read_at = now()
  WHERE user_id = '11111111-1111-1111-1111-111111111111';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  -- Il blocco 27 lascia gia' una notifica per A: qui interessa che la
  -- UPDATE passi (>= 1), non quante righe ha toccato.
  IF v_n < 1 THEN
    RAISE EXCEPTION 'read_at non aggiornato: % righe', v_n;
  END IF;
END $$;
RESET ROLE;

-- 40c. service_role: avanza i marcatori di delivery -> ok.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"service_role"}';
DO $$
DECLARE v_n INTEGER;
BEGIN
  UPDATE public.push_notifications
  SET push_sent_at = now(), push_attempts = 2
  WHERE user_id = '11111111-1111-1111-1111-111111111111';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  -- Piu' righe per A (blocco 27 + la fixture qui sopra): basta che la
  -- patch passi, non quante righe tocca.
  IF v_n < 1 THEN
    RAISE EXCEPTION 'service_role non ha marcato la delivery: % righe', v_n;
  END IF;
END $$;
RESET ROLE;

-- 40d. service_role: non puo' riscrivere il contenuto -> P0001.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"service_role"}';
DO $$
BEGIN
  BEGIN
    UPDATE public.push_notifications SET title = 'riscritto'
    WHERE user_id = '11111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'title da service_role: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'service_role ha riscritto title';
END $$;
RESET ROLE;

-- 40e. anon non scrive su push_subscriptions.
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
DO $$
BEGIN
  BEGIN
    INSERT INTO public.push_subscriptions (user_id, subscription)
    VALUES ('11111111-1111-1111-1111-111111111111', '{"endpoint":"x"}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'insert anon su push_subscriptions: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'anon ha scritto su push_subscriptions';
END $$;
RESET ROLE;

-- 40f. Utente: gestisce le proprie subscription (policy ALL della 001).
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
DECLARE v_n INTEGER;
BEGIN
  INSERT INTO public.push_subscriptions (user_id, subscription)
  VALUES ('11111111-1111-1111-1111-111111111111', '{"endpoint":"https://push.test/a"}'::jsonb);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'utente non ha inserito la propria subscription: % righe', v_n;
  END IF;
END $$;
RESET ROLE;
-- 40g. La policy ALL su push_subscriptions ("Users can manage own push
-- subscriptions", 001) non ha WITH CHECK: Postgres usa USING come controllo
-- in scrittura. Questo blocco inchioda il comportamento: se qualcuno aggiunge
-- un WITH CHECK permissivo, 40g fallisce qui (leak) invece di passare in silenzio.
-- 40g-a. A non inserisce con user_id di B -> 42501.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    INSERT INTO public.push_subscriptions (user_id, subscription)
    VALUES ('22222222-2222-2222-2222-222222222222', '{"endpoint":"https://attacker.test/x"}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'insert subscription altrui: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'A ha scritto una subscription con user_id di B';
END $$;
RESET ROLE;

-- 40g-b. positivo: A inserisce con il proprio uid -> ok.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
DECLARE v_n INTEGER;
BEGIN
  INSERT INTO public.push_subscriptions (user_id, subscription)
  VALUES ('11111111-1111-1111-1111-111111111111', '{"endpoint":"https://push.test/40g"}'::jsonb);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'utente non ha inserito la propria subscription (40g): % righe', v_n;
  END IF;
END $$;
RESET ROLE;

-- ================= 41. #47: esito proposta + resubmit dopo rifiuto =================
-- Fixture: due rejected di A con riga di audit rifiutata (flusso reale:
-- submit crea la pending, reject aggiorna entrambe le righe).
INSERT INTO public.courts (name, lat, lng, location, source, submitted_by, moderation_status, status, photo_path)
VALUES
  ('Resubmit Court', 41.92, 12.52, ST_SetSRID(ST_MakePoint(12.52,41.92),4326)::geography, 'community',
   '11111111-1111-1111-1111-111111111111','rejected','active','11111111-1111-1111-1111-111111111111/reject.jpg'),
  ('Resubmit Other', 41.925, 12.525, ST_SetSRID(ST_MakePoint(12.525,41.925),4326)::geography, 'community',
   '11111111-1111-1111-1111-111111111111','rejected','active',NULL);
INSERT INTO public.court_submissions (court_id, submitter_id, raw_name, lat, lng, photo_path, status, moderation_note)
VALUES
  ((SELECT id FROM public.courts WHERE name = 'Resubmit Court'),
   '11111111-1111-1111-1111-111111111111', 'Resubmit Court', 41.92, 12.52,
   '11111111-1111-1111-1111-111111111111/reject.jpg', 'rejected', 'foto illeggibile'),
  ((SELECT id FROM public.courts WHERE name = 'Resubmit Other'),
   '11111111-1111-1111-1111-111111111111', 'Resubmit Other', 41.925, 12.525, NULL, 'rejected', 'doppione? no');

-- 41a. positivo: A ripropone la propria rejected -> pending, nuova riga
-- pending, la rejected resta come storia.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
SELECT public.resubmit_submission((SELECT id FROM public.courts WHERE name = 'Resubmit Court'));
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courts
                 WHERE name = 'Resubmit Court' AND moderation_status = 'pending' AND duplicate_of IS NULL) THEN
    RAISE EXCEPTION 'resubmit non ha rimesso la corte in pending';
  END IF;
  IF (SELECT count(*) FROM public.court_submissions cs JOIN public.courts c ON c.id = cs.court_id
      WHERE c.name = 'Resubmit Court' AND cs.status = 'pending') <> 1 THEN
    RAISE EXCEPTION 'nuova riga pending mancante dopo resubmit';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.court_submissions cs JOIN public.courts c ON c.id = cs.court_id
                 WHERE c.name = 'Resubmit Court' AND cs.status = 'rejected') THEN
    RAISE EXCEPTION 'riga rejected sparita dopo resubmit (deve restare come storia)';
  END IF;
END $$;

-- 41b. riproporre una pending -> P0001.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.resubmit_submission((SELECT id FROM public.courts WHERE name = 'Resubmit Court'));
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'resubmit di pending: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'resubmit di corte pending riuscito';
END $$;
RESET ROLE;

-- 41c. riproporre una approved altrui -> P0001.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.resubmit_submission((SELECT id FROM public.courts WHERE name = 'C Court'));
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'resubmit di approved: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'resubmit di corte approved riuscito';
END $$;
RESET ROLE;

-- 41d. C ripropone la rejected di A -> P0001.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.resubmit_submission((SELECT id FROM public.courts WHERE name = 'Resubmit Other'));
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'resubmit altrui: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'resubmit di proposta altrui riuscito';
END $$;
RESET ROLE;

-- 41e. anon non esegue resubmit -> 42501 (nessun grant).
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
DO $$
BEGIN
  BEGIN
    PERFORM public.resubmit_submission((SELECT id FROM public.courts WHERE name = 'Resubmit Other'));
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'resubmit da anon: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'anon ha eseguito resubmit_submission';
END $$;
RESET ROLE;

-- 41f. positivo: B approva la pending di A -> una sola notifica al proponente.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
SELECT public.approve_court((SELECT id FROM public.courts WHERE name = 'Resubmit Court'));
RESET ROLE;
DO $$ DECLARE v_n BIGINT; BEGIN
  SELECT count(*) INTO v_n FROM public.push_notifications
  WHERE user_id = '11111111-1111-1111-1111-111111111111'
    AND title = 'Proposta approvata'
    AND data->>'type' = 'court_moderation'
    AND data->>'status' = 'approved'
    AND (data->>'court_id')::uuid = (SELECT id FROM public.courts WHERE name = 'Resubmit Court');
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'notifiche di approvazione per il proponente: % (atteso 1)', v_n;
  END IF;
END $$;

-- 41g. positivo: A ripropone e B rifiuta con nota -> una sola notifica con il motivo.
-- (Il resubmit serve: dalla 030+M1 solo una pending si puo' rifiutare.)
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
SELECT public.resubmit_submission((SELECT id FROM public.courts WHERE name = 'Resubmit Other'));
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
SELECT public.reject_court((SELECT id FROM public.courts WHERE name = 'Resubmit Other'), 'foto mossa');
RESET ROLE;
DO $$ DECLARE v_n BIGINT; BEGIN
  SELECT count(*) INTO v_n FROM public.push_notifications
  WHERE user_id = '11111111-1111-1111-1111-111111111111'
    AND title = 'Proposta rifiutata'
    AND body LIKE '%Motivo: foto mossa%'
    AND data->>'type' = 'court_moderation'
    AND data->>'status' = 'rejected'
    AND (data->>'court_id')::uuid = (SELECT id FROM public.courts WHERE name = 'Resubmit Other');
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'notifiche di rifiuto per il proponente: % (atteso 1)', v_n;
  END IF;
END $$;

-- 41h. corte senza proponente: la moderazione notifica nulla e non fallisce.
INSERT INTO public.courts (name, lat, lng, location, source, submitted_by, moderation_status, status)
VALUES ('Orphan Mod Court', 41.93, 12.53, ST_SetSRID(ST_MakePoint(12.53,41.93),4326)::geography, 'community',
        NULL,'pending','active');
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
SELECT public.approve_court((SELECT id FROM public.courts WHERE name = 'Orphan Mod Court'));
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.push_notifications
             WHERE (data->>'court_id')::uuid = (SELECT id FROM public.courts WHERE name = 'Orphan Mod Court')) THEN
    RAISE EXCEPTION 'notifica creata per corte senza proponente';
  END IF;
END $$;
-- ================= 42. #75: submit_court con indirizzo umano opzionale =================
-- `p_address` (8o parametro, DEFAULT NULL): trimmato, vuoto -> NULL, max 200
-- caratteri e niente control/newline (P0001); salvato in `courts.address`.
-- La vecchia firma a 7 argomenti non esiste piu' (overload rimosso dal DROP
-- in 031). Ogni submit riuscito consuma la quota giornaliera (055: 2/giorno),
-- quindi i due casi positivi usano utenti dedicati (D/E); i negativi non
-- scrivono righe e riusano F.
INSERT INTO auth.users (id, email) VALUES
  ('44444444-4444-4444-4444-444444444444','d@test.local'),
  ('55555555-5555-5555-5555-555555555555','e@test.local'),
  ('66666666-6666-6666-6666-666666666666','f@test.local');

-- 42a. positivo: D invia con indirizzo spaziato -> trimmato in courts.address.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
DO $$
DECLARE v UUID;
BEGIN
  v := public.submit_court('Addr Court', 41.90, 12.50, NULL, NULL, NULL, NULL, '  Via Roma 10, Roma  ');
  IF v IS NULL THEN RAISE EXCEPTION 'submit con address ha restituito null'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courts WHERE name = 'Addr Court' AND address = 'Via Roma 10, Roma') THEN
    RAISE EXCEPTION 'address non trimmato/salvato in courts.address';
  END IF;
END $$;

-- 42b. positivo: indirizzo vuoto/bianco -> NULL.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
SELECT public.submit_court('Blank Addr Court', 41.901, 12.501, NULL, NULL, NULL, NULL, '   ');
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courts WHERE name = 'Blank Addr Court' AND address IS NULL) THEN
    RAISE EXCEPTION 'address bianco non normalizzato a NULL';
  END IF;
END $$;

-- 42c. 250 caratteri -> P0001.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.submit_court('Long Addr Court', 41.902, 12.502, NULL, NULL, NULL, NULL, repeat('x', 250));
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'address 250ch: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'address di 250 caratteri accettato';
END $$;
RESET ROLE;

-- 42d. newline -> P0001.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.submit_court('NL Addr Court', 41.903, 12.503, NULL, NULL, NULL, NULL, 'Via Roma 10' || chr(10) || 'Roma');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'address con newline: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'address con newline accettato';
END $$;
RESET ROLE;

-- 42e. la vecchia firma a 7 argomenti non esiste piu' (42883/undefined_function).
DO $$
DECLARE v_oid OID;
BEGIN
  BEGIN
    SELECT 'public.submit_court(text, double precision, double precision, text, text, text, double precision)'::regprocedure INTO v_oid;
  EXCEPTION WHEN undefined_function THEN
    RETURN;
  END;
  RAISE EXCEPTION 'vecchio overload submit_court a 7 argomenti ancora presente';
END $$;

-- 42f. anon non esegue submit_court -> 42501 (nessun grant sulla nuova firma).
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
DO $$
BEGIN
  BEGIN
    PERFORM public.submit_court('Anon Addr', 41.904, 12.504, NULL, NULL, NULL, NULL, 'Via Roma 1');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'submit da anon: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'anon ha eseguito submit_court';
END $$;
RESET ROLE;

-- 42g. resubmit conserva l'address (030 tocca solo moderation_status/duplicate_of).
INSERT INTO public.courts (name, lat, lng, location, source, submitted_by, moderation_status, status, address)
VALUES ('Addr Resubmit', 41.905, 12.505, ST_SetSRID(ST_MakePoint(12.505,41.905),4326)::geography, 'community',
        '44444444-4444-4444-4444-444444444444','rejected','active','Via Milano 3');
INSERT INTO public.court_submissions (court_id, submitter_id, raw_name, lat, lng, status, moderation_note)
VALUES ((SELECT id FROM public.courts WHERE name = 'Addr Resubmit'),
        '44444444-4444-4444-4444-444444444444', 'Addr Resubmit', 41.905, 12.505, 'rejected', 'indirizzo?');
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
SELECT public.resubmit_submission((SELECT id FROM public.courts WHERE name = 'Addr Resubmit'));
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courts
                 WHERE name = 'Addr Resubmit' AND moderation_status = 'pending' AND address = 'Via Milano 3') THEN
    RAISE EXCEPTION 'resubmit ha perso address';
  END IF;
END $$;
-- 42h. submit senza uid (claim senza sub) -> 42501 (m1: prima era P0001,
-- stessa classe dei dinieghi come resubmit_submission).
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.submit_court('No Uid Court', 41.908, 12.508);
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'submit senza uid: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'submit senza uid riuscito';
END $$;
RESET ROLE;

-- ================= 43. #47: storico audit intatto + transizione condizionale =================
-- B2: approve/reject toccano solo la riga di audit ancora pending; le righe
-- storiche (rejected con nota) non si riscrivono mai. M1: la transizione
-- avviene solo da pending; un secondo approve fallisce con P0001 e non crea
-- una seconda notifica.
-- Fixture: 'Storia Court' (pending di F) con una riga di audit pending.
INSERT INTO public.courts (name, lat, lng, location, source, submitted_by, moderation_status, status)
VALUES ('Storia Court', 41.906, 12.506, ST_SetSRID(ST_MakePoint(12.506,41.906),4326)::geography, 'community',
        '66666666-6666-6666-6666-666666666666','pending','active');
INSERT INTO public.court_submissions (court_id, submitter_id, raw_name, lat, lng, status)
VALUES ((SELECT id FROM public.courts WHERE name = 'Storia Court'),
        '66666666-6666-6666-6666-666666666666', 'Storia Court', 41.906, 12.506, 'pending');

-- 43a. submit_court accetta un indirizzo non-ASCII (#75: [[:print:]] in UTF-8
-- non deve rifiutare accentate e apostrofi).
INSERT INTO auth.users (id, email) VALUES ('77777777-7777-7777-7777-777777777777','g@test.local');
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}';
DO $$
DECLARE v UUID;
BEGIN
  v := public.submit_court('Via Niccolò Court', 41.907, 12.507, NULL, NULL, NULL, NULL, 'Via Niccolò 1, Città Sant''Angelo');
  IF v IS NULL THEN RAISE EXCEPTION 'submit con address non-ASCII ha restituito null'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courts
                 WHERE name = 'Via Niccolò Court' AND address = 'Via Niccolò 1, Città Sant''Angelo') THEN
    RAISE EXCEPTION 'address non-ASCII non salvato in courts.address';
  END IF;
END $$;

-- 43b. B rifiuta la pending con nota: la riga diventa rejected con la nota.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
SELECT public.reject_court((SELECT id FROM public.courts WHERE name = 'Storia Court'), 'prima nota');
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courts
                 WHERE name = 'Storia Court' AND moderation_status = 'rejected') THEN
    RAISE EXCEPTION 'corte non rifiutata';
  END IF;
END $$;

-- 43c. F ripropone: torna pending con una NUOVA riga, la rejected resta storia.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';
SELECT public.resubmit_submission((SELECT id FROM public.courts WHERE name = 'Storia Court'));
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courts
                 WHERE name = 'Storia Court' AND moderation_status = 'pending') THEN
    RAISE EXCEPTION 'resubmit non ha rimesso la corte in pending';
  END IF;
  IF (SELECT count(*) FROM public.court_submissions cs JOIN public.courts c ON c.id = cs.court_id
      WHERE c.name = 'Storia Court' AND cs.status = 'rejected') <> 1 THEN
    RAISE EXCEPTION 'riga rejected sparita dopo resubmit (deve restare come storia)';
  END IF;
END $$;

-- 43d. B approva: la pending diventa approved, la storica resta rejected con nota.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
SELECT public.approve_court((SELECT id FROM public.courts WHERE name = 'Storia Court'));
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courts
                 WHERE name = 'Storia Court' AND moderation_status = 'approved') THEN
    RAISE EXCEPTION 'corte non approvata';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.court_submissions cs JOIN public.courts c ON c.id = cs.court_id
                 WHERE c.name = 'Storia Court' AND cs.status = 'rejected' AND cs.moderation_note = 'prima nota') THEN
    RAISE EXCEPTION 'approve ha riscritto la riga storica (nota persa)';
  END IF;
  IF (SELECT count(*) FROM public.court_submissions cs JOIN public.courts c ON c.id = cs.court_id
      WHERE c.name = 'Storia Court' AND cs.status = 'approved') <> 1 THEN
    RAISE EXCEPTION 'approve non ha aggiornato la sola pending (attesa 1 riga approved)';
  END IF;
END $$;

-- 43e. secondo approve sulla stessa corte -> P0001 con messaggio dedicato,
-- nessuna seconda notifica (M1: la notifica parte solo sulla transizione reale).
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.approve_court((SELECT id FROM public.courts WHERE name = 'Storia Court'));
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN
      IF SQLERRM NOT LIKE '%non è più in attesa%' THEN
        RAISE EXCEPTION 'secondo approve: messaggio inatteso: %', SQLERRM;
      END IF;
      RETURN;
    END IF;
    RAISE EXCEPTION 'secondo approve: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'secondo approve riuscito (doppia transizione/notifica?)';
END $$;
RESET ROLE;
DO $$ DECLARE v_n BIGINT; BEGIN
  SELECT count(*) INTO v_n FROM public.push_notifications
  WHERE user_id = '66666666-6666-6666-6666-666666666666'
    AND title = 'Proposta approvata'
    AND data->>'type' = 'court_moderation'
    AND data->>'status' = 'approved'
    AND (data->>'court_id')::uuid = (SELECT id FROM public.courts WHERE name = 'Storia Court');
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'notifiche di approvazione per Storia Court: % (attesa 1)', v_n;
  END IF;
END $$;

-- 43f. reject su una pending con DUE righe di audit aggiorna solo la pending
-- (B2): la storica resta rejected con la sua nota.
INSERT INTO public.courts (name, lat, lng, location, source, submitted_by, moderation_status, status)
VALUES ('Doppia Court', 41.909, 12.509, ST_SetSRID(ST_MakePoint(12.509,41.909),4326)::geography, 'community',
        '66666666-6666-6666-6666-666666666666','pending','active');
INSERT INTO public.court_submissions (court_id, submitter_id, raw_name, lat, lng, status, moderation_note)
VALUES
  ((SELECT id FROM public.courts WHERE name = 'Doppia Court'),
   '66666666-6666-6666-6666-666666666666', 'Doppia Court', 41.909, 12.509, 'rejected', 'vecchia nota'),
  ((SELECT id FROM public.courts WHERE name = 'Doppia Court'),
   '66666666-6666-6666-6666-666666666666', 'Doppia Court', 41.909, 12.509, 'pending', NULL);
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
SELECT public.reject_court((SELECT id FROM public.courts WHERE name = 'Doppia Court'), 'nuova nota');
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.court_submissions cs JOIN public.courts c ON c.id = cs.court_id
                 WHERE c.name = 'Doppia Court' AND cs.status = 'rejected' AND cs.moderation_note = 'vecchia nota') THEN
    RAISE EXCEPTION 'reject ha riscritto la riga storica (vecchia nota persa)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.court_submissions cs JOIN public.courts c ON c.id = cs.court_id
                 WHERE c.name = 'Doppia Court' AND cs.status = 'rejected' AND cs.moderation_note = 'nuova nota') THEN
    RAISE EXCEPTION 'reject non ha registrato la nuova nota sulla pending';
  END IF;
END $$;

-- ================= 44. #34: court_reviews, una riga per utente+corte =================
-- Fixture dedicate (setup come postgres, bypassa RLS): una corte approvata e
-- una pending. Seed con recensioni di A su entrambe (media/count della view
-- verificati al punto g con altre due righe).
INSERT INTO public.courts (name, lat, lng, location, source, submitted_by, moderation_status, status)
VALUES
  ('Review Approved', 41.90, 12.50, ST_SetSRID(ST_MakePoint(12.50,41.90),4326)::geography, 'community',
   '11111111-1111-1111-1111-111111111111','approved','active'),
  ('Review Pending', 41.91, 12.51, ST_SetSRID(ST_MakePoint(12.51,41.91),4326)::geography, 'community',
   '11111111-1111-1111-1111-111111111111','pending','active');
INSERT INTO public.court_reviews (user_id, court_id, rating, body)
VALUES
  ('11111111-1111-1111-1111-111111111111',
   (SELECT id FROM public.courts WHERE name = 'Review Approved'), 4, 'Bel campo'),
  ('11111111-1111-1111-1111-111111111111',
   (SELECT id FROM public.courts WHERE name = 'Review Pending'), 5, NULL);

-- 44a. anon legge le recensioni della corte approvata, nulla della pending.
-- L'atteso del totale si calcola da postgres (bypassa RLS): il DB locale puo'
-- contenere recensioni preesistenti, quindi un numero scritto a mano
-- fallirebbe appena qualcuno recensisce dalla UI.
SELECT set_config('test.anon_reviews', (
  SELECT count(*)::text
  FROM public.court_reviews r
  JOIN public.courts c ON c.id = r.court_id
  WHERE c.moderation_status = 'approved'), true);
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
DO $$ DECLARE v_n BIGINT; v_expected BIGINT; BEGIN
  SELECT count(*) INTO v_n FROM public.court_reviews
  WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Review Approved');
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'anon vede % recensioni su corte approvata (attesa 1)', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM public.court_reviews
  WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Review Pending');
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'anon vede % recensioni su corte pending (attese 0)', v_n;
  END IF;
  -- Totale: tutte e sole le recensioni di corti approvate. Contare solo per
  -- corte non basta: la subselect da' NULL per la pending anche senza RLS.
  v_expected := current_setting('test.anon_reviews')::bigint;
  SELECT count(*) INTO v_n FROM public.court_reviews;
  IF v_n <> v_expected THEN
    RAISE EXCEPTION 'anon vede % recensioni totali (attese %)', v_n, v_expected;
  END IF;
END $$;
RESET ROLE;
-- L'autore rivede la propria riga anche sulla pending de-approvata.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.court_reviews
                 WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Review Pending')) THEN
    RAISE EXCEPTION 'autore non rivede la propria recensione su pending';
  END IF;
END $$;
RESET ROLE;

-- 44b. positivo: A inserisce rating 1..5; rating 0/6 -> 23514, body 501ch e
-- body di soli spazi -> 23514.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
INSERT INTO public.court_reviews (user_id, court_id, rating, body)
VALUES ('11111111-1111-1111-1111-111111111111',
        (SELECT id FROM public.courts WHERE name = 'C Court'), 5, 'Ottimo!');
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.court_reviews
                 WHERE user_id = '11111111-1111-1111-1111-111111111111'
                   AND court_id = (SELECT id FROM public.courts WHERE name = 'C Court')
                   AND rating = 5) THEN
    RAISE EXCEPTION 'insert rating 5 di A non riuscito';
  END IF;
END $$;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    INSERT INTO public.court_reviews (user_id, court_id, rating)
    VALUES ('22222222-2222-2222-2222-222222222222',
            (SELECT id FROM public.courts WHERE name = 'C Court'), 0);
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '23514' THEN RETURN; END IF;
    RAISE EXCEPTION 'rating 0: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'rating 0 accettato';
END $$;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.court_reviews (user_id, court_id, rating)
    VALUES ('22222222-2222-2222-2222-222222222222',
            (SELECT id FROM public.courts WHERE name = 'C Court'), 6);
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '23514' THEN RETURN; END IF;
    RAISE EXCEPTION 'rating 6: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'rating 6 accettato';
END $$;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.court_reviews (user_id, court_id, rating, body)
    VALUES ('22222222-2222-2222-2222-222222222222',
            (SELECT id FROM public.courts WHERE name = 'C Court'), 3, repeat('x', 501));
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '23514' THEN RETURN; END IF;
    RAISE EXCEPTION 'body 501ch: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'body di 501 caratteri accettato';
END $$;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.court_reviews (user_id, court_id, rating, body)
    VALUES ('22222222-2222-2222-2222-222222222222',
            (SELECT id FROM public.courts WHERE name = 'C Court'), 3, '   ');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '23514' THEN RETURN; END IF;
    RAISE EXCEPTION 'body spazi: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'body di soli spazi accettato (va inviato NULL)';
END $$;
RESET ROLE;

-- 44c. B non aggiorna né cancella la recensione di A: 0 righe, riga invariata.
-- (La RLS filtra in silenzio: si asserisce l'effetto, non l'errore.)
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
DO $$
DECLARE v_n INTEGER;
BEGIN
  UPDATE public.court_reviews SET rating = 1
  WHERE user_id = '11111111-1111-1111-1111-111111111111'
    AND court_id = (SELECT id FROM public.courts WHERE name = 'Review Approved');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'B ha aggiornato % righe di A', v_n;
  END IF;
  DELETE FROM public.court_reviews
  WHERE user_id = '11111111-1111-1111-1111-111111111111'
    AND court_id = (SELECT id FROM public.courts WHERE name = 'Review Approved');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'B ha cancellato % righe di A', v_n;
  END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.court_reviews
                 WHERE user_id = '11111111-1111-1111-1111-111111111111'
                   AND court_id = (SELECT id FROM public.courts WHERE name = 'Review Approved')
                   AND rating = 4) THEN
    RAISE EXCEPTION 'recensione di A alterata da B';
  END IF;
END $$;

-- 44d. insert su corte pending -> 42501 (nessun insert-oracle sulla moderazione).
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    INSERT INTO public.court_reviews (user_id, court_id, rating)
    VALUES ('33333333-3333-3333-3333-333333333333',
            (SELECT id FROM public.courts WHERE name = 'Review Pending'), 4);
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'review su pending: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'recensione su corte pending riuscita';
END $$;
RESET ROLE;

-- 44e. seconda recensione dello stesso utente sulla stessa corte -> 23505.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    INSERT INTO public.court_reviews (user_id, court_id, rating)
    VALUES ('11111111-1111-1111-1111-111111111111',
            (SELECT id FROM public.courts WHERE name = 'Review Approved'), 2);
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '23505' THEN RETURN; END IF;
    RAISE EXCEPTION 'doppia review: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'doppia recensione riuscita (manca unique)';
END $$;
RESET ROLE;

-- 44f. il guard nega il cambio di court_id (P0001) ma lascia passare il
-- cambio di rating.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    UPDATE public.court_reviews
    SET court_id = (SELECT id FROM public.courts WHERE name = 'C Court')
    WHERE user_id = '11111111-1111-1111-1111-111111111111'
      AND court_id = (SELECT id FROM public.courts WHERE name = 'Review Approved');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'cambio court_id: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'cambio di court_id riuscito (guard mancante?)';
END $$;
UPDATE public.court_reviews SET rating = 5
WHERE user_id = '11111111-1111-1111-1111-111111111111'
  AND court_id = (SELECT id FROM public.courts WHERE name = 'Review Approved');
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.court_reviews
                 WHERE user_id = '11111111-1111-1111-1111-111111111111'
                   AND court_id = (SELECT id FROM public.courts WHERE name = 'Review Approved')
                   AND rating = 5) THEN
    RAISE EXCEPTION 'cambio rating lecito bloccato dal guard';
  END IF;
END $$;

-- 44g. `court_rating_summary`: media/count giusti sulla corte approvata,
-- niente righe per la pending ad anon.
INSERT INTO public.court_reviews (user_id, court_id, rating)
VALUES
  ('22222222-2222-2222-2222-222222222222',
   (SELECT id FROM public.courts WHERE name = 'Review Approved'), 5),
  ('33333333-3333-3333-3333-333333333333',
   (SELECT id FROM public.courts WHERE name = 'Review Approved'), 2);
SELECT set_config('test.anon_summary', (
  SELECT count(*)::text
  FROM public.court_rating_summary s
  JOIN public.courts c ON c.id = s.court_id
  WHERE c.moderation_status = 'approved'), true);
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
DO $$ DECLARE v_avg NUMERIC; v_n INTEGER; v_expected BIGINT; BEGIN
  SELECT average, count INTO v_avg, v_n FROM public.court_rating_summary
  WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Review Approved');
  -- Rating: A=5 (punto f), B=5, C=2 -> media 4.0, count 3.
  IF v_avg <> 4.0 OR v_n <> 3 THEN
    RAISE EXCEPTION 'summary su approvata: average=%, count=% (attesi 4.0, 3)', v_avg, v_n;
  END IF;
  IF EXISTS (SELECT 1 FROM public.court_rating_summary
             WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Review Pending')) THEN
    RAISE EXCEPTION 'summary leaka la pending ad anon';
  END IF;
  -- Totale: righe di corti approvate, calcolate da postgres prima del cambio
  -- ruolo. Un numero fisso fallirebbe appena il DB locale ha altre recensioni.
  v_expected := current_setting('test.anon_summary')::bigint;
  SELECT count(*) INTO v_n FROM public.court_rating_summary;
  IF v_n <> v_expected THEN
    RAISE EXCEPTION 'summary ad anon: % righe (attese %)', v_n, v_expected;
  END IF;
END $$;
RESET ROLE;

-- ================= 45. #84/055: quota giornaliera per utente + anti-spam testo =================
-- Corte di appoggio (postgres: nessun claim -> i trigger di rate limit non
-- contano, come per seed e cron).
INSERT INTO public.courts (name, lat, lng, location, source, moderation_status, status)
VALUES ('Rate Limit Court', 41.91, 12.51,
        ST_SetSRID(ST_MakePoint(12.51, 41.91),4326)::geography,
        'community', 'approved', 'active');

-- A inserisce 10 segnalazioni (quota 10/giorno), l'undicesima viene fermata.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
INSERT INTO public.court_reports (court_id, user_id, category, expires_at)
SELECT (SELECT id FROM public.courts WHERE name = 'Rate Limit Court'),
       '11111111-1111-1111-1111-111111111111',
       'other',
       now() + interval '1 hour'
FROM generate_series(1, 10);

DO $$
BEGIN
  BEGIN
    INSERT INTO public.court_reports (court_id, user_id, category, expires_at)
    VALUES ((SELECT id FROM public.courts WHERE name = 'Rate Limit Court'),
            '11111111-1111-1111-1111-111111111111',
            'other',
            now() + interval '1 hour');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN
      IF SQLERRM NOT LIKE '%giornaliero%' THEN
        RAISE EXCEPTION 'quota: messaggio senza nome azione: %', SQLERRM;
      END IF;
      RETURN;
    END IF;
    RAISE EXCEPTION 'undicesima segnalazione: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'undicesima segnalazione accettata (quota assente?)';
END $$;
RESET ROLE;

-- B non eredita gli eventi di A: la finestra e' per (bucket, utente).
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
INSERT INTO public.court_reports (court_id, user_id, category, expires_at)
VALUES ((SELECT id FROM public.courts WHERE name = 'Rate Limit Court'),
        '33333333-3333-3333-3333-333333333333',
        'other',
        now() + interval '1 hour');
RESET ROLE;

-- Gli eventi non sono leggibili dal client, nemmeno dal proprietario.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
BEGIN
  -- Nessun grant: il client riceve 42501 già sul privilegio, prima della RLS.
  BEGIN
    PERFORM count(*) FROM public.rate_limit_events;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'rate_limit_events: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'rate_limit_events leggibile dal client (grant mancante?)';
END $$;
RESET ROLE;

-- Anti-spam: nome/indirizzo con un link viene fermato (guard su courts).
DO $$
BEGIN
  BEGIN
    INSERT INTO public.courts (name, lat, lng, location, source, submitted_by, moderation_status, status)
    VALUES ('Campo https://spam.example', 41.92, 12.52,
            ST_SetSRID(ST_MakePoint(12.52, 41.92),4326)::geography,
            'community', '11111111-1111-1111-1111-111111111111', 'pending', 'active');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'nome con link: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'nome con link accettato (guard assente?)';
END $$;

-- ... e un nome normale passa (il guard non e' un blocco generico).
INSERT INTO public.courts (name, lat, lng, location, source, submitted_by, moderation_status, status)
VALUES ('Campo Via dei Test 12', 41.93, 12.53,
        ST_SetSRID(ST_MakePoint(12.53, 41.93),4326)::geography,
        'community', '11111111-1111-1111-1111-111111111111', 'pending', 'active');

-- ================= 46. #91: riconferma in finestra, fuori finestra no, riga altrui negata =================
-- Migrazione A (037): `reconfirm_lobby()` scrive `reconfirmed_at`, la
-- finestra 24h->30min sta nel DB (funzione + guard). Fixture dedicata:
-- corte approvata + due lobby di C (una in finestra, una fuori). A e'
-- bannato dal blocco 39, quindi si usa C; i claim si azzerano (stile
-- blocchi anon) perche' il trigger ban legge auth.uid(), non il creator_id.
SET LOCAL request.jwt.claims = '';
DO $$
DECLARE
  v_court UUID;
  v_in_window UUID;
  v_out_window UUID;
BEGIN
  INSERT INTO public.courts (name, lat, lng, location, source, submitted_by, moderation_status, status)
  VALUES ('Reconfirm Court', 41.906, 12.506, ST_SetSRID(ST_MakePoint(12.506,41.906),4326)::geography, 'community',
          '33333333-3333-3333-3333-333333333333','approved','active')
  RETURNING id INTO v_court;
  -- In finestra: inizio tra 2h (finestra: da 22h fa a tra 1.5h).
  INSERT INTO public.lobbies (court_id, creator_id, start_time, max_players, status)
  VALUES (v_court, '33333333-3333-3333-3333-333333333333', now() + interval '2 hours', 10, 'open')
  RETURNING id INTO v_in_window;
  -- Fuori finestra: inizio tra 10 minuti (finestra chiusa da 20 minuti).
  INSERT INTO public.lobbies (court_id, creator_id, start_time, max_players, status)
  VALUES (v_court, '33333333-3333-3333-3333-333333333333', now() + interval '10 minutes', 10, 'open')
  RETURNING id INTO v_out_window;
  INSERT INTO public.lobby_participants (lobby_id, user_id)
  VALUES (v_in_window, '33333333-3333-3333-3333-333333333333'),
         (v_out_window, '33333333-3333-3333-3333-333333333333');
END $$;

-- 46a. positivo: C riconferma in finestra -> reconfirmed_at valorizzato.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
DO $$
DECLARE
  v_lobby UUID;
BEGIN
  SELECT id INTO v_lobby FROM public.lobbies
  WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Reconfirm Court')
    AND start_time > now() + interval '1 hour';
  PERFORM public.reconfirm_lobby(v_lobby);
  IF NOT EXISTS (SELECT 1 FROM public.lobby_participants
                 WHERE lobby_id = v_lobby
                   AND user_id = '33333333-3333-3333-3333-333333333333'
                   AND reconfirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'riconferma in finestra: reconfirmed_at resta NULL';
  END IF;
END $$;
RESET ROLE;

-- 46b. fuori finestra: funzione e UPDATE diretto -> P0001, valore invariato.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
DO $$
DECLARE
  v_lobby UUID;
  v_via_funzione BOOLEAN := FALSE;
BEGIN
  SELECT id INTO v_lobby FROM public.lobbies
  WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Reconfirm Court')
    AND start_time < now() + interval '1 hour';
  BEGIN
    PERFORM public.reconfirm_lobby(v_lobby);
    v_via_funzione := TRUE;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> 'P0001' THEN
      RAISE EXCEPTION 'riconferma fuori finestra: SQLSTATE % anomalo', SQLSTATE;
    END IF;
  END;
  IF v_via_funzione THEN
    RAISE EXCEPTION 'riconferma fuori finestra riuscita via funzione';
  END IF;
  BEGIN
    UPDATE public.lobby_participants SET reconfirmed_at = now()
    WHERE lobby_id = v_lobby AND user_id = '33333333-3333-3333-3333-333333333333';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> 'P0001' THEN
      RAISE EXCEPTION 'UPDATE diretto fuori finestra: SQLSTATE % anomalo', SQLSTATE;
    END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'UPDATE diretto fuori finestra riuscito';
END $$;
RESET ROLE;

-- 46c. B non iscritto: funzione -> 42501; UPDATE diretto -> 0 righe.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
DO $$
DECLARE
  v_lobby UUID;
  v_toccate INTEGER;
  v_via_funzione BOOLEAN := FALSE;
BEGIN
  SELECT id INTO v_lobby FROM public.lobbies
  WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Reconfirm Court')
    AND start_time > now() + interval '1 hour';
  BEGIN
    PERFORM public.reconfirm_lobby(v_lobby);
    v_via_funzione := TRUE;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> '42501' THEN
      RAISE EXCEPTION 'riconferma altrui: SQLSTATE % anomalo', SQLSTATE;
    END IF;
  END;
  IF v_via_funzione THEN
    RAISE EXCEPTION 'riconferma sulla riga altrui riuscita';
  END IF;
  UPDATE public.lobby_participants SET reconfirmed_at = now()
  WHERE lobby_id = v_lobby AND user_id = '33333333-3333-3333-3333-333333333333';
  GET DIAGNOSTICS v_toccate = ROW_COUNT;
  IF v_toccate <> 0 THEN
    RAISE EXCEPTION 'UPDATE diretto sulla riga altrui: % righe toccate', v_toccate;
  END IF;
END $$;
RESET ROLE;

-- ================= 47. #84/035: grant al minimo, nessun privilegio inutile =================
DO $$
DECLARE v_pair RECORD;
BEGIN
  -- Matrice "tabella -> privilegio che deve restare": tutto il resto deve
  -- essere negato. Se un privilegio torna per default (nuova migrazione),
  -- questo blocco lo segnala.
  FOR v_pair IN
    SELECT * FROM (VALUES
      ('courts', 'SELECT'),
      ('court_submissions', 'SELECT'),
      ('profiles', 'SELECT'),
      ('profiles', 'UPDATE'),
      ('lobbies', 'SELECT'),
      ('lobbies', 'INSERT'),
      ('lobbies', 'UPDATE'),
      ('lobby_participants', 'SELECT'),
      ('lobby_participants', 'UPDATE'),
      ('lobby_participants', 'DELETE'),
      ('check_ins', 'SELECT'),
      ('check_ins', 'INSERT'),
      ('check_ins', 'UPDATE'),
      ('court_reports', 'SELECT'),
      ('court_reports', 'INSERT'),
      ('court_reviews', 'SELECT'),
      ('push_notifications', 'SELECT'),
      ('push_notifications', 'UPDATE'),
      ('push_subscriptions', 'INSERT'),
      ('push_subscriptions', 'DELETE'),
      ('user_favorites', 'INSERT'),
      ('user_favorites', 'DELETE')
    ) AS t(tab, priv)
  LOOP
    IF NOT has_table_privilege('authenticated', 'public.' || v_pair.tab, v_pair.priv) THEN
      RAISE EXCEPTION 'grant mancante: authenticated % su %', v_pair.priv, v_pair.tab;
    END IF;
  END LOOP;

  -- Scritture che non devono esistere nemmeno con RLS.
  IF has_table_privilege('authenticated', 'public.courts', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated puo'' aggiornare courts via grant';
  END IF;
  IF has_table_privilege('authenticated', 'public.lobbies', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated puo'' cancellare lobbies via grant';
  END IF;
  IF has_table_privilege('anon', 'public.push_notifications', 'SELECT') THEN
    RAISE EXCEPTION 'anon legge push_notifications via grant';
  END IF;
  IF has_table_privilege('authenticated', 'public.courts', 'TRUNCATE') THEN
    RAISE EXCEPTION 'TRUNCATE concesso su courts';
  END IF;
END $$;

-- ================= 48. #91/039: il -3 non colpisce chi era in campo =================
-- (a) check-in prima della riconferma -> orfano all'INSERT, agganciato dal
-- backfill alla riconferma, nessun -3 alla chiusura.
-- (b) checkout manuale prima della chiusura -> nessun -3 (predicato di presenza).
-- (c) join con reconfirmed_at preimpostato -> 42501; join normale ancora ok.
-- Fixture dedicate (postgres, bypassa RLS): il karma si misura dopo il
-- check-in (+1 di 39f) e prima della chiusura, conta solo il delta.
DO $$
DECLARE
  v_court UUID;
  v_lobby UUID;
BEGIN
  -- (a) lobby tra 45min: dentro la finestra di riconferma (fino a -30min) e
  -- con checked_in_at=NOW() dentro [start-2h, ends_at].
  INSERT INTO public.courts (name, lat, lng, location, source, submitted_by, moderation_status, status)
  VALUES ('Backfill Court', 41.907, 12.507, ST_SetSRID(ST_MakePoint(12.507,41.907),4326)::geography, 'community',
          '33333333-3333-3333-3333-333333333333','approved','active')
  RETURNING id INTO v_court;
  INSERT INTO public.lobbies (court_id, creator_id, start_time, max_players, status)
  VALUES (v_court, '33333333-3333-3333-3333-333333333333', now() + interval '45 minutes', 10, 'open')
  RETURNING id INTO v_lobby;
  INSERT INTO public.lobby_participants (lobby_id, user_id)
  VALUES (v_lobby, '33333333-3333-3333-3333-333333333333');

  -- (b) lobby iniziata 30min fa, dura 120min: ends_at tra 90min.
  INSERT INTO public.courts (name, lat, lng, location, source, submitted_by, moderation_status, status)
  VALUES ('Checkout Court', 41.908, 12.508, ST_SetSRID(ST_MakePoint(12.508,41.908),4326)::geography, 'community',
          '33333333-3333-3333-3333-333333333333','approved','active')
  RETURNING id INTO v_court;
  INSERT INTO public.lobbies (court_id, creator_id, start_time, duration_minutes, max_players, status)
  VALUES (v_court, '33333333-3333-3333-3333-333333333333', now() - interval '30 minutes', 120, 10, 'open')
  RETURNING id INTO v_lobby;
  INSERT INTO public.lobby_participants (lobby_id, user_id, reconfirmed_at)
  VALUES (v_lobby, '33333333-3333-3333-3333-333333333333', now() - interval '1 hour');

  -- (c) lobby di B per il buco INSERT: B e' il creatore, cosi' il suo join
  -- non spara notify_participant_joined (solo join non-creatore, e
  -- authenticated non ha INSERT su push_notifications per la 035).
  INSERT INTO public.courts (name, lat, lng, location, source, submitted_by, moderation_status, status)
  VALUES ('Join Policy Court', 41.909, 12.509, ST_SetSRID(ST_MakePoint(12.509,41.909),4326)::geography, 'community',
          '22222222-2222-2222-2222-222222222222','approved','active')
  RETURNING id INTO v_court;
  INSERT INTO public.lobbies (court_id, creator_id, start_time, max_players, status)
  VALUES (v_court, '22222222-2222-2222-2222-222222222222', now() + interval '2 hours', 10, 'open')
  RETURNING id INTO v_lobby;
END $$;

-- 48a-1. check-in di C prima della riconferma: resta orfano (assign solo all'INSERT).
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
INSERT INTO public.check_ins (user_id, court_id, lat, lng)
VALUES ('33333333-3333-3333-3333-333333333333',
        (SELECT id FROM public.courts WHERE name = 'Backfill Court'), 41.907, 12.507);
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.check_ins ci JOIN public.courts c ON c.id = ci.court_id
             WHERE c.name = 'Backfill Court' AND ci.lobby_id IS NOT NULL) THEN
    RAISE EXCEPTION 'check-in pre-riconferma agganciato senza riconferma';
  END IF;
END $$;

-- 48a-2. C riconferma in finestra -> backfill aggancia il check-in.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
UPDATE public.lobby_participants SET reconfirmed_at = now()
WHERE lobby_id = (SELECT id FROM public.lobbies
                  WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Backfill Court'))
  AND user_id = '33333333-3333-3333-3333-333333333333';
RESET ROLE;
DO $$
DECLARE
  v_before INTEGER;
  v_after INTEGER;
  v_lobby UUID;
  v_n BIGINT;
BEGIN
  SELECT id INTO v_lobby FROM public.lobbies
  WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Backfill Court');
  IF NOT EXISTS (SELECT 1 FROM public.check_ins WHERE lobby_id = v_lobby) THEN
    RAISE EXCEPTION 'backfill alla riconferma: check-in ancora orfano';
  END IF;
  SELECT karma_score INTO v_before FROM public.profiles
  WHERE user_id = '33333333-3333-3333-3333-333333333333';
  UPDATE public.lobbies SET status = 'closed' WHERE id = v_lobby;
  SELECT karma_score INTO v_after FROM public.profiles
  WHERE user_id = '33333333-3333-3333-3333-333333333333';
  IF v_after <> v_before THEN
    RAISE EXCEPTION 'karma dopo chiusura con presenza: % -> % (atteso invariato)', v_before, v_after;
  END IF;
  SELECT count(*) INTO v_n FROM public.push_notifications
  WHERE user_id = '33333333-3333-3333-3333-333333333333'
    AND data->>'type' = 'karma_loss'
    AND (data->>'lobby_id')::uuid = v_lobby;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'karma_loss notifica nonostante la presenza: %', v_n;
  END IF;
END $$;

-- 48b-1. check-in di C sulla lobby gia' iniziata: agganciato all'INSERT.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
INSERT INTO public.check_ins (user_id, court_id, lat, lng)
VALUES ('33333333-3333-3333-3333-333333333333',
        (SELECT id FROM public.courts WHERE name = 'Checkout Court'), 41.908, 12.508);
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.check_ins ci JOIN public.courts c ON c.id = ci.court_id
                 JOIN public.lobbies l ON l.id = ci.lobby_id
                 JOIN public.courts cc ON cc.id = l.court_id
                 WHERE c.name = 'Checkout Court' AND cc.name = 'Checkout Court') THEN
    RAISE EXCEPTION 'check-in su lobby riconfermata non agganciato all''INSERT';
  END IF;
END $$;

-- 48b-2. checkout manuale prima della chiusura -> nessun -3.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
UPDATE public.check_ins SET status = 'checked_out', checked_out_at = now()
WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Checkout Court')
  AND user_id = '33333333-3333-3333-3333-333333333333';
RESET ROLE;
DO $$
DECLARE
  v_before INTEGER;
  v_after INTEGER;
  v_lobby UUID;
  v_n BIGINT;
BEGIN
  SELECT id INTO v_lobby FROM public.lobbies
  WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Checkout Court');
  SELECT karma_score INTO v_before FROM public.profiles
  WHERE user_id = '33333333-3333-3333-3333-333333333333';
  UPDATE public.lobbies SET status = 'closed' WHERE id = v_lobby;
  SELECT karma_score INTO v_after FROM public.profiles
  WHERE user_id = '33333333-3333-3333-3333-333333333333';
  IF v_after <> v_before THEN
    RAISE EXCEPTION 'karma dopo checkout manuale: % -> % (atteso invariato)', v_before, v_after;
  END IF;
  SELECT count(*) INTO v_n FROM public.push_notifications
  WHERE user_id = '33333333-3333-3333-3333-333333333333'
    AND data->>'type' = 'karma_loss'
    AND (data->>'lobby_id')::uuid = v_lobby;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'karma_loss notifica dopo checkout manuale: %', v_n;
  END IF;
END $$;

-- 48c. B entra con reconfirmed_at preimpostato -> 42501, nessuna riga.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
DO $$
DECLARE
  v_lobby UUID;
BEGIN
  SELECT id INTO v_lobby FROM public.lobbies
  WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Join Policy Court');
  BEGIN
    INSERT INTO public.lobby_participants (lobby_id, user_id, reconfirmed_at)
    VALUES (v_lobby, '22222222-2222-2222-2222-222222222222', now());
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'join con reconfirmed_at: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'join con reconfirmed_at preimpostato riuscito (buco INSERT)';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.lobby_participants
             WHERE user_id = '22222222-2222-2222-2222-222222222222'
               AND lobby_id IN (SELECT id FROM public.lobbies
                                WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Join Policy Court'))
               AND reconfirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'riga con reconfirmed_at preimpostato presente nonostante il diniego';
  END IF;
END $$;

-- 48c-bis. positivo: il join normale passa ancora (la policy non over-blocca).
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
INSERT INTO public.lobby_participants (lobby_id, user_id)
VALUES ((SELECT id FROM public.lobbies
         WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Join Policy Court')),
        '22222222-2222-2222-2222-222222222222');
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.lobby_participants
                 WHERE user_id = '22222222-2222-2222-2222-222222222222'
                   AND lobby_id IN (SELECT id FROM public.lobbies
                                    WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Join Policy Court'))
                   AND reconfirmed_at IS NULL) THEN
    RAISE EXCEPTION 'join normale bloccato dalla policy 039';
  END IF;
END $$;
DELETE FROM public.lobby_participants
WHERE user_id = '22222222-2222-2222-2222-222222222222'
  AND lobby_id IN (SELECT id FROM public.lobbies
                   WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Join Policy Court'));

-- ================= 49. #100: il join di un secondo utente riesce =================
-- P0: `notify_participant_joined` era SECURITY INVOKER e l'INSERT in
-- `push_notifications` moriva (035 revoca INSERT ad authenticated),
-- annullando il join. La 040 lo porta a DEFINER. Qui il join lo fa davvero
-- B autenticato sulla lobby di C, con i permessi del client: prima della
-- 040 falliva con permission denied. Il creatore riceve la notifica.
SET LOCAL request.jwt.claims = '';
DO $$
DECLARE
  v_court UUID;
  v_lobby UUID;
BEGIN
  INSERT INTO public.courts (name, lat, lng, location, source, submitted_by, moderation_status, status)
  VALUES ('Second Join Court', 41.912, 12.512, ST_SetSRID(ST_MakePoint(12.512,41.912),4326)::geography, 'community',
          '33333333-3333-3333-3333-333333333333','approved','active')
  RETURNING id INTO v_court;
  INSERT INTO public.lobbies (court_id, creator_id, start_time, max_players, status)
  VALUES (v_court, '33333333-3333-3333-3333-333333333333', now() + interval '2 hours', 10, 'open')
  RETURNING id INTO v_lobby;
  INSERT INTO public.lobby_participants (lobby_id, user_id)
  VALUES (v_lobby, '33333333-3333-3333-3333-333333333333');
END $$;

-- 49a. B si unisce alla lobby di C: riesce, e C viene notificato.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
INSERT INTO public.lobby_participants (lobby_id, user_id)
VALUES ((SELECT id FROM public.lobbies
         WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Second Join Court')),
        '22222222-2222-2222-2222-222222222222');
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.lobby_participants
                 WHERE user_id = '22222222-2222-2222-2222-222222222222'
                   AND lobby_id IN (SELECT id FROM public.lobbies
                                    WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Second Join Court'))) THEN
    RAISE EXCEPTION 'join del secondo utente fallito (#100)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.push_notifications
                 WHERE user_id = '33333333-3333-3333-3333-333333333333'
                   AND data->>'type' = 'participant_joined'
                   AND (data->>'lobby_id')::uuid IN (SELECT id FROM public.lobbies
                                    WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Second Join Court'))) THEN
    RAISE EXCEPTION 'notifica participant_joined mancante (#100)';
  END IF;
END $$;

-- ================= 50. #94: delete utente -> lobby con creator NULL, zero orfani =================
-- Fixture: corte approvata + lobby passata di A con B iscritto, e una riga
-- di A in ogni tabella utente (profilo via handle_new_user, check-in,
-- report, review, preferito, notifica, submission, subscription).
-- 50a. con i permessi del client la cancellazione fallisce; 50b. con i
-- permessi del server (service_role/postgres, come la route di delete)
-- la cascata lascia la lobby con creator_id NULL, le partecipazioni di B
-- intatte e nessuna riga orfana su A.
DO $$
DECLARE
  v_court UUID;
  v_lobby UUID;
BEGIN
  INSERT INTO public.courts (name, lat, lng, location, source, submitted_by, moderation_status, status)
  VALUES ('Delete Me Court', 41.913, 12.513, ST_SetSRID(ST_MakePoint(12.513,41.913),4326)::geography, 'community',
          '11111111-1111-1111-1111-111111111111','approved','active')
  RETURNING id INTO v_court;
  INSERT INTO public.lobbies (court_id, creator_id, start_time, max_players, status)
  VALUES (v_court, '11111111-1111-1111-1111-111111111111', now() - interval '1 day', 10, 'open')
  RETURNING id INTO v_lobby;
  INSERT INTO public.lobby_participants (lobby_id, user_id)
  VALUES (v_lobby, '22222222-2222-2222-2222-222222222222');
  INSERT INTO public.check_ins (user_id, court_id, lat, lng)
  VALUES ('11111111-1111-1111-1111-111111111111', v_court, 41.913, 12.513);
  INSERT INTO public.court_reports (court_id, user_id, category, expires_at)
  VALUES (v_court, '11111111-1111-1111-1111-111111111111', 'other', now() + interval '1 day');
  INSERT INTO public.court_reviews (court_id, user_id, rating)
  VALUES (v_court, '11111111-1111-1111-1111-111111111111', 5);
  INSERT INTO public.user_favorites (user_id, court_id)
  VALUES ('11111111-1111-1111-1111-111111111111', v_court);
  INSERT INTO public.push_notifications (user_id, title, body)
  VALUES ('11111111-1111-1111-1111-111111111111', 'Delete Me', 'corpo');
  INSERT INTO public.court_submissions (court_id, submitter_id, raw_name, lat, lng, status)
  VALUES (v_court, '11111111-1111-1111-1111-111111111111', 'Delete Me Court', 41.913, 12.513, 'pending');
  INSERT INTO public.push_subscriptions (user_id, subscription)
  VALUES ('11111111-1111-1111-1111-111111111111', '{"endpoint":"https://push.test/delete-me"}'::jsonb);
END $$;

-- 50a. A non cancella se stesso con i permessi del client -> 42501.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    DELETE FROM auth.users WHERE id = '11111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'delete utente da client: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'client ha cancellato auth.users (#94)';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = '11111111-1111-1111-1111-111111111111') THEN
    RAISE EXCEPTION 'utente sparito dopo delete negata (#94)';
  END IF;
END $$;

-- 50b. delete con i permessi del server: la lobby sopravvive senza creatore.
DELETE FROM auth.users WHERE id = '11111111-1111-1111-1111-111111111111';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = '11111111-1111-1111-1111-111111111111') THEN
    RAISE EXCEPTION 'delete server di auth.users non riuscita (#94)';
  END IF;
  -- La lobby passata di A esiste ancora, con creator_id NULL (041).
  IF NOT EXISTS (SELECT 1 FROM public.lobbies l JOIN public.courts c ON c.id = l.court_id
                 WHERE c.name = 'Delete Me Court' AND l.creator_id IS NULL) THEN
    RAISE EXCEPTION 'lobby sparita o creator non azzerato dopo il delete (#94)';
  END IF;
  -- La partecipazione di B e' intatta.
  IF NOT EXISTS (SELECT 1 FROM public.lobby_participants lp JOIN public.lobbies l ON l.id = lp.lobby_id
                 JOIN public.courts c ON c.id = l.court_id
                 WHERE c.name = 'Delete Me Court'
                   AND lp.user_id = '22222222-2222-2222-2222-222222222222') THEN
    RAISE EXCEPTION 'partecipazione altrui persa nel delete (#94)';
  END IF;
  -- Nessuna riga orfana su A: tutto cio' che e' riga-utente e' cascato.
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = '11111111-1111-1111-1111-111111111111') THEN
    RAISE EXCEPTION 'profilo orfano dopo il delete (#94)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.lobby_participants WHERE user_id = '11111111-1111-1111-1111-111111111111') THEN
    RAISE EXCEPTION 'partecipazione orfana dopo il delete (#94)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.check_ins WHERE user_id = '11111111-1111-1111-1111-111111111111') THEN
    RAISE EXCEPTION 'check-in orfano dopo il delete (#94)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.court_reports WHERE user_id = '11111111-1111-1111-1111-111111111111') THEN
    RAISE EXCEPTION 'report orfano dopo il delete (#94)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.court_reviews WHERE user_id = '11111111-1111-1111-1111-111111111111') THEN
    RAISE EXCEPTION 'review orfana dopo il delete (#94)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_favorites WHERE user_id = '11111111-1111-1111-1111-111111111111') THEN
    RAISE EXCEPTION 'preferito orfano dopo il delete (#94)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.push_notifications WHERE user_id = '11111111-1111-1111-1111-111111111111') THEN
    RAISE EXCEPTION 'notifica orfana dopo il delete (#94)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id = '11111111-1111-1111-1111-111111111111') THEN
    RAISE EXCEPTION 'subscription orfana dopo il delete (#94)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.court_submissions WHERE submitter_id = '11111111-1111-1111-1111-111111111111') THEN
    RAISE EXCEPTION 'submission orfana dopo il delete (#94)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.lobbies WHERE creator_id = '11111111-1111-1111-1111-111111111111') THEN
    RAISE EXCEPTION 'lobby con creator fantasma dopo il delete (#94)';
  END IF;
END $$;

-- ================= 51. #94: scrub `data->'user_id'` solo come rimozione chiave =================
-- La 042 apre al service_role un'eccezione stretta: togliere la sola chiave
-- `user_id` da `data`. Qui si inchioda il confine: rimozione ok, ogni
-- altra riscrittura vietata, utente mai.
-- Il blocco 50 cancella l'utente A: qui si usano B (proprio) e C (altrui).
INSERT INTO public.push_notifications (user_id, title, body, data)
VALUES ('33333333-3333-3333-3333-333333333333', 'Scrub Me', 'corpo',
        '{"type":"participant_joined","lobby_id":"00000000-0000-0000-0000-000000000000","user_id":"22222222-2222-2222-2222-222222222222"}'::jsonb);

-- 51a. service_role toglie la chiave -> ok, il resto intatto.
SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claims = '{"role":"service_role"}';
UPDATE public.push_notifications
SET data = data - 'user_id'
WHERE user_id = '33333333-3333-3333-3333-333333333333' AND title = 'Scrub Me';
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.push_notifications
                 WHERE title = 'Scrub Me'
                   AND data = '{"type":"participant_joined","lobby_id":"00000000-0000-0000-0000-000000000000"}'::jsonb) THEN
    RAISE EXCEPTION 'scrub service_role non riuscito o data alterata (#94)';
  END IF;
END $$;

-- 51a-bis. scrub + read_at insieme: comportamento voluto (i marcatori di
-- recapito e read_at restano liberi al service_role come da 029/040).
INSERT INTO public.push_notifications (user_id, title, body, data)
VALUES ('33333333-3333-3333-3333-333333333333', 'Scrub E Read', 'corpo',
        '{"type":"x","user_id":"22222222-2222-2222-2222-222222222222"}'::jsonb);
SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claims = '{"role":"service_role"}';
UPDATE public.push_notifications
SET data = data - 'user_id', read_at = now()
WHERE user_id = '33333333-3333-3333-3333-333333333333' AND title = 'Scrub E Read';
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.push_notifications
                 WHERE title = 'Scrub E Read'
                   AND data = '{"type":"x"}'::jsonb
                   AND read_at IS NOT NULL) THEN
    RAISE EXCEPTION 'scrub+read_at non riuscito (#94)';
  END IF;
END $$;

-- 51b. service_role riscrive il titolo -> P0001 (nessuna regressione 40d).
SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claims = '{"role":"service_role"}';
DO $$
BEGIN
  BEGIN
    UPDATE public.push_notifications SET title = 'riscritto'
    WHERE title = 'Scrub Me';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'title da service_role: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'service_role ha riscritto title (#94)';
END $$;
RESET ROLE;

-- 51c. service_role cambia `data` oltre la rimozione -> P0001.
SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claims = '{"role":"service_role"}';
DO $$
BEGIN
  BEGIN
    UPDATE public.push_notifications SET data = '{"type":"x"}'::jsonb
    WHERE title = 'Scrub Me';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'data rewrite da service_role: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'service_role ha riscritto data (#94)';
END $$;
RESET ROLE;

INSERT INTO public.push_notifications (user_id, title, body, data)
VALUES ('22222222-2222-2222-2222-222222222222', 'Propria Con Chiave', 'corpo',
        '{"type":"participant_joined","user_id":"33333333-3333-3333-3333-333333333333"}'::jsonb);

-- 51d. l'utente non toglie `user_id` dalla riga altrui: 0 righe (policy
-- own-row), e sulla propria con chiave il trigger nega con P0001.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
DO $$ DECLARE v_n INTEGER; BEGIN
  UPDATE public.push_notifications SET data = data - 'user_id'
  WHERE title = 'Scrub Me';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'utente ha scrubato la riga altrui: % righe (#94)', v_n;
  END IF;
  BEGIN
    UPDATE public.push_notifications SET data = data - 'user_id'
    WHERE title = 'Propria Con Chiave';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'scrub utente su propria riga: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'utente ha modificato data della propria riga (#94)';
END $$;
RESET ROLE;

-- ================= 52. #94: il delete gira anche con lo search_path di gotrue =================
-- `auth.admin.deleteUser` gira come `supabase_auth_admin`, il cui
-- search_path e' solo `auth` (il postgres locale non e' superuser, quindi
-- non puo' farne SET ROLE: si replica il path, che e' cio' che rompeva).
-- La cascata tocca `courts` (`submitted_by` SET NULL) e senza la 043 il
-- trigger location moriva con `type "geography" does not exist`. Il blocco
-- 50 copre il DELETE diretto; qui si copre il path reale di gotrue.
-- Utente fresco H (8888): zero lobby create, niente rate limit; il profilo
-- nasce dal trigger handle_new_user. Claim azzerati: auth.uid() deve essere
-- NULL, altrimenti il rate limit legge lo uid residuo di un blocco prima.
SET LOCAL request.jwt.claims = '';
DO $$
DECLARE
  v_court UUID;
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    ('88888888-8888-8888-8888-888888888888','h@test.local');
  INSERT INTO public.courts (name, lat, lng, location, source, submitted_by, moderation_status, status)
  VALUES ('Auth Admin Court', 41.914, 12.514, ST_SetSRID(ST_MakePoint(12.514,41.914),4326)::geography, 'community',
          '88888888-8888-8888-8888-888888888888','approved','active')
  RETURNING id INTO v_court;
  INSERT INTO public.lobbies (court_id, creator_id, start_time, max_players, status)
  VALUES (v_court, '88888888-8888-8888-8888-888888888888', now() + interval '2 hours', 10, 'open');
END $$;
SET LOCAL search_path = auth;
DELETE FROM auth.users WHERE id = '88888888-8888-8888-8888-888888888888';
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = '88888888-8888-8888-8888-888888888888') THEN
    RAISE EXCEPTION 'delete come supabase_auth_admin non riuscito (#94)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lobbies l JOIN public.courts c ON c.id = l.court_id
                 WHERE c.name = 'Auth Admin Court' AND l.creator_id IS NULL) THEN
    RAISE EXCEPTION 'lobby senza creator dopo delete auth_admin (#94)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.courts
                 WHERE name = 'Auth Admin Court' AND submitted_by IS NULL) THEN
    RAISE EXCEPTION 'submitted_by non azzerato dopo delete auth_admin (#94)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.courts
                 WHERE name = 'Auth Admin Court' AND location IS NOT NULL) THEN
    RAISE EXCEPTION 'location persa nel SET NULL auth_admin (#94)';
  END IF;
END $$;

-- ================= 53. #92: join oltre capienza rifiutato dal DB =================
-- Il "pieno" era solo client (`count >= max_players`); la 045 lo porta nel
-- DB con `FOR UPDATE` sulla lobby (gli INSERT concorrenti si serializzano:
-- il secondo aspetta il commit del primo e poi conta anche la sua riga).
-- Utenti freschi D/E/F: A e' stato cancellato dal blocco 50.
-- Utenti D/E/F esistono gia' dal blocco 42 (A e' stato cancellato dal 50).
-- Il blocco 52 lascia `search_path = auth` (simula gotrue) e il file e' una
-- sola transazione: si ripristina il path (stessa coppia della 043).
SET LOCAL search_path = public, extensions;
SET LOCAL request.jwt.claims = '';
DO $$
DECLARE
  v_court UUID;
  v_lobby UUID;
BEGIN
  INSERT INTO public.courts (name, lat, lng, location, source, submitted_by, moderation_status, status)
  VALUES ('Capacity Court', 41.915, 12.515, ST_SetSRID(ST_MakePoint(12.515,41.915),4326)::geography, 'community',
          '44444444-4444-4444-4444-444444444444','approved','active')
  RETURNING id INTO v_court;
  INSERT INTO public.lobbies (court_id, creator_id, start_time, max_players, status)
  VALUES (v_court, '44444444-4444-4444-4444-444444444444', now() + interval '2 hours', 2, 'open')
  RETURNING id INTO v_lobby;
  INSERT INTO public.lobby_participants (lobby_id, user_id)
  VALUES (v_lobby, '44444444-4444-4444-4444-444444444444');
END $$;

-- 53a. E entra (2/2): riesce.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
INSERT INTO public.lobby_participants (lobby_id, user_id)
VALUES ((SELECT id FROM public.lobbies
         WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Capacity Court')),
        '55555555-5555-5555-5555-555555555555');
RESET ROLE;

-- 53b. F oltre capienza -> P0001 (passa la RLS, la nega il trigger 045).
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    INSERT INTO public.lobby_participants (lobby_id, user_id)
    VALUES ((SELECT id FROM public.lobbies
             WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Capacity Court')),
            '66666666-6666-6666-6666-666666666666');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'join oltre capienza: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'join oltre capienza riuscito (#92)';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.lobby_participants
      WHERE lobby_id IN (SELECT id FROM public.lobbies
                         WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Capacity Court'))) <> 2 THEN
    RAISE EXCEPTION 'capienza corrotta (#92)';
  END IF;
END $$;

-- ================= 54. #92: il partecipante chiude l'Occorrenza di Serie =================
-- Scelta (a): chi ha Confermato puo' chiudere la singola Occorrenza
-- (open -> closed); il resto resta del creatore (policy 001 invariata).
SET LOCAL request.jwt.claims = '';
DO $$
DECLARE
  v_court UUID;
  v_series UUID;
  v_occ1 UUID;
  v_occ2 UUID;
BEGIN
  INSERT INTO public.courts (name, lat, lng, location, source, submitted_by, moderation_status, status)
  VALUES ('Series Court', 41.916, 12.516, ST_SetSRID(ST_MakePoint(12.516,41.916),4326)::geography, 'community',
          '44444444-4444-4444-4444-444444444444','approved','active')
  RETURNING id INTO v_court;
  INSERT INTO public.lobby_series (court_id, creator_id, weekday, time_of_day, duration_minutes, max_players)
  VALUES (v_court, '44444444-4444-4444-4444-444444444444', 4, '20:00', 60, 10)
  RETURNING id INTO v_series;
  INSERT INTO public.lobbies (court_id, creator_id, start_time, max_players, status, duration_minutes, series_id)
  VALUES (v_court, '44444444-4444-4444-4444-444444444444', now() + interval '2 days', 10, 'open', 60, v_series)
  RETURNING id INTO v_occ1;
  INSERT INTO public.lobbies (court_id, creator_id, start_time, max_players, status, duration_minutes, series_id)
  VALUES (v_court, '44444444-4444-4444-4444-444444444444', now() + interval '3 days', 10, 'open', 60, v_series)
  RETURNING id INTO v_occ2;
  INSERT INTO public.lobby_participants (lobby_id, user_id)
  VALUES (v_occ1, '55555555-5555-5555-5555-555555555555');
END $$;

-- 54a. E (partecipante) chiude l'Occorrenza: riesce.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
UPDATE public.lobbies SET status = 'closed'
WHERE id IN (SELECT l.id FROM public.lobbies l JOIN public.courts c ON c.id = l.court_id
             WHERE c.name = 'Series Court' AND l.series_id IS NOT NULL
             ORDER BY l.start_time ASC LIMIT 1);
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.lobbies l JOIN public.courts c ON c.id = l.court_id
                 WHERE c.name = 'Series Court' AND l.status = 'closed' AND l.series_id IS NOT NULL) THEN
    RAISE EXCEPTION 'partecipante non ha chiuso l''occorrenza (#92)';
  END IF;
END $$;

-- 54b. E non riapre (closed -> open): P0001 del guard.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    UPDATE public.lobbies SET status = 'open'
    WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Series Court')
      AND status = 'closed' AND series_id IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'riapertura occorrenza: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'partecipante ha riaperto l''occorrenza (#92)';
END $$;
RESET ROLE;

-- 54c. E non tocca null'altro (max_players): P0001 del guard.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    UPDATE public.lobbies SET max_players = 4
    WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Series Court')
      AND status = 'closed' AND series_id IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'modifica occorrenza altrui: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'partecipante ha modificato l''occorrenza (#92)';
END $$;
RESET ROLE;

-- 54d. D (creatore) resta libero sulle proprie Occorrenze: riesce.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
UPDATE public.lobbies SET max_players = 12
WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Series Court')
  AND status = 'closed' AND series_id IS NOT NULL;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.lobbies l JOIN public.courts c ON c.id = l.court_id
                 WHERE c.name = 'Series Court' AND l.max_players = 12 AND l.series_id IS NOT NULL) THEN
    RAISE EXCEPTION 'creatore bloccato sulla propria occorrenza (#92)';
  END IF;
END $$;

-- ================= 55. #92: il non-partecipante non chiude =================
-- F non e' iscritto all'Occorrenza aperta (occ2, +3 giorni): nessuna policy
-- passa -> 42501.
-- F non e' iscritto all'Occorrenza aperta (occ2, +3 giorni): nessuna policy
-- passa -> 0 righe (su UPDATE la RLS negata non alza errori, cfr 51d).
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';
DO $$
DECLARE
  v_n INTEGER;
BEGIN
  UPDATE public.lobbies SET status = 'closed'
  WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Series Court')
    AND status = 'open' AND series_id IS NOT NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'non-partecipante ha chiuso % occorrenze (#92)', v_n;
  END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.lobbies l JOIN public.courts c ON c.id = l.court_id
                 WHERE c.name = 'Series Court' AND l.status = 'open' AND l.series_id IS NOT NULL) THEN
    RAISE EXCEPTION 'occorrenza chiusa dal non-partecipante (#92)';
  END IF;
END $$;

-- ================= 56. #92: kill-switch sulle Serie orfane =================
-- Serie di D con E iscritto a un'Occorrenza passata (-2 giorni, entro i 28:
-- il kill-switch vuole occorrenze già iniziate, mai solo future); poi D
-- viene cancellato (creator_id -> NULL come la 041). E puo' solo disattivare,
-- F (non-partecipante) niente, e finche' il creatore esiste il kill-switch
-- non passa.
SET LOCAL request.jwt.claims = '';
DO $$
DECLARE
  v_court UUID;
  v_series UUID;
  v_occ UUID;
BEGIN
  INSERT INTO public.courts (name, lat, lng, location, source, submitted_by, moderation_status, status)
  VALUES ('Orphan Court', 41.917, 12.517, ST_SetSRID(ST_MakePoint(12.517,41.917),4326)::geography, 'community',
          '44444444-4444-4444-4444-444444444444','approved','active')
  RETURNING id INTO v_court;
  INSERT INTO public.lobby_series (court_id, creator_id, weekday, time_of_day, duration_minutes, max_players)
  VALUES (v_court, '44444444-4444-4444-4444-444444444444', 4, '20:00', 60, 10)
  RETURNING id INTO v_series;
  INSERT INTO public.lobbies (court_id, creator_id, start_time, max_players, status, duration_minutes, series_id)
  VALUES (v_court, '44444444-4444-4444-4444-444444444444', now() - interval '2 days', 10, 'open', 60, v_series)
  RETURNING id INTO v_occ;
  INSERT INTO public.lobby_participants (lobby_id, user_id)
  VALUES (v_occ, '55555555-5555-5555-5555-555555555555');
  INSERT INTO public.lobby_series (court_id, creator_id, weekday, time_of_day)
  VALUES (v_court, '55555555-5555-5555-5555-555555555555', 5, '19:00');
END $$;
DELETE FROM auth.users WHERE id = '44444444-4444-4444-4444-444444444444';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.lobby_series s JOIN public.courts c ON c.id = s.court_id
                 WHERE c.name = 'Orphan Court' AND s.creator_id IS NULL AND s.weekday = 4) THEN
    RAISE EXCEPTION 'serie non orfana dopo il delete (#92)';
  END IF;
END $$;

-- 56a. E (partecipante) disattiva la Serie orfana: riesce.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
UPDATE public.lobby_series SET active = false
WHERE id IN (SELECT s.id FROM public.lobby_series s JOIN public.courts c ON c.id = s.court_id
             WHERE c.name = 'Orphan Court' AND s.creator_id IS NULL);
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.lobby_series s JOIN public.courts c ON c.id = s.court_id
                 WHERE c.name = 'Orphan Court' AND s.creator_id IS NULL AND s.active = false) THEN
    RAISE EXCEPTION 'kill-switch orfano fallito (#92)';
  END IF;
END $$;

-- 56b. F (non-partecipante) non disattiva: 0 righe (RLS negata su UPDATE).
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';
DO $$
DECLARE
  v_n INTEGER;
BEGIN
  UPDATE public.lobby_series SET active = false
  WHERE id IN (SELECT s.id FROM public.lobby_series s JOIN public.courts c ON c.id = s.court_id
               WHERE c.name = 'Orphan Court' AND s.creator_id IS NULL);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'non-partecipante ha disattivato % serie (#92)', v_n;
  END IF;
END $$;
RESET ROLE;

-- 56c. E non cambia la regola (ora): P0001 del guard.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    UPDATE public.lobby_series SET time_of_day = '21:00'
    WHERE id IN (SELECT s.id FROM public.lobby_series s JOIN public.courts c ON c.id = s.court_id
                 WHERE c.name = 'Orphan Court' AND s.creator_id IS NULL);
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'modifica serie orfana: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'partecipante ha cambiato la regola orfana (#92)';
END $$;
RESET ROLE;

-- 56d. E non riattiva (false -> true): P0001 del guard.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    UPDATE public.lobby_series SET active = true
    WHERE id IN (SELECT s.id FROM public.lobby_series s JOIN public.courts c ON c.id = s.court_id
                 WHERE c.name = 'Orphan Court' AND s.creator_id IS NULL);
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'riattivazione orfana: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'partecipante ha riattivato la serie orfana (#92)';
END $$;
RESET ROLE;

-- 56e. Creatore vivo: F non tocca la Serie di E -> 0 righe (kill-switch solo orfano).
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';
DO $$
DECLARE
  v_n INTEGER;
BEGIN
  UPDATE public.lobby_series SET active = false
  WHERE creator_id = '55555555-5555-5555-5555-555555555555';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'serie con creatore disattivata da estraneo: % righe (#92)', v_n;
  END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.lobby_series
                 WHERE creator_id = '55555555-5555-5555-5555-555555555555' AND active = true) THEN
    RAISE EXCEPTION 'serie viva disattivata (#92)';
  END IF;
END $$;

-- 56f. Il creatore cambia la regola ma non creator_id (provenienza immutabile).
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
UPDATE public.lobby_series SET time_of_day = '19:30'
WHERE creator_id = '55555555-5555-5555-5555-555555555555';
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.lobby_series
                 WHERE creator_id = '55555555-5555-5555-5555-555555555555' AND time_of_day = '19:30') THEN
    RAISE EXCEPTION 'creatore non aggiorna la propria regola (#92)';
  END IF;
END $$;

-- 56f-2. ... ma non cede la serie a F: 42501 del guard.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    UPDATE public.lobby_series SET creator_id = '66666666-6666-6666-6666-666666666666'
    WHERE creator_id = '55555555-5555-5555-5555-555555555555';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'cessione serie: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'creatore ha ceduto la serie (#92)';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.lobby_series
                 WHERE creator_id = '55555555-5555-5555-5555-555555555555') THEN
    RAISE EXCEPTION 'serie ceduta nonostante il guard (#92)';
  END IF;
END $$;

-- 56f-3. ... né si auto-orfanizza (creator_id = NULL): 42501 del guard.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    UPDATE public.lobby_series SET creator_id = NULL
    WHERE creator_id = '55555555-5555-5555-5555-555555555555';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'auto-orfanizzazione: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'creatore ha auto-orfanizzato la serie (#92)';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.lobby_series
                 WHERE creator_id = '55555555-5555-5555-5555-555555555555') THEN
    RAISE EXCEPTION 'serie orfanizzata nonostante il guard (#92)';
  END IF;
END $$;

-- 56g. Kill-switch solo su occorrenze già iniziate (<= NOW()): F con sola
-- occorrenza futura (+10 giorni) non spegne; E con occorrenza passata
-- (-5 giorni, entro i 28) sì.
SET LOCAL request.jwt.claims = '';
DO $$
DECLARE
  v_court UUID;
  v_fut UUID;
  v_past UUID;
  v_of UUID;
  v_op UUID;
BEGIN
  SELECT id INTO v_court FROM public.courts WHERE name = 'Orphan Court' LIMIT 1;
  INSERT INTO public.lobby_series (court_id, creator_id, weekday, time_of_day)
  VALUES (v_court, NULL, 6, '18:00') RETURNING id INTO v_fut;
  INSERT INTO public.lobbies (court_id, creator_id, start_time, max_players, status, duration_minutes, series_id)
  VALUES (v_court, NULL, now() + interval '10 days', 10, 'open', 60, v_fut) RETURNING id INTO v_of;
  INSERT INTO public.lobby_participants (lobby_id, user_id)
  VALUES (v_of, '66666666-6666-6666-6666-666666666666');
  INSERT INTO public.lobby_series (court_id, creator_id, weekday, time_of_day)
  VALUES (v_court, NULL, 2, '18:00') RETURNING id INTO v_past;
  INSERT INTO public.lobbies (court_id, creator_id, start_time, max_players, status, duration_minutes, series_id)
  VALUES (v_court, NULL, now() - interval '5 days', 10, 'open', 60, v_past) RETURNING id INTO v_op;
  INSERT INTO public.lobby_participants (lobby_id, user_id)
  VALUES (v_op, '55555555-5555-5555-5555-555555555555');
END $$;

-- 56g-1. F (sola futura) non spegne: 0 righe (RLS negata su UPDATE).
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';
DO $$
DECLARE
  v_n INTEGER;
BEGIN
  UPDATE public.lobby_series SET active = false
  WHERE id IN (SELECT s.id FROM public.lobby_series s JOIN public.courts c ON c.id = s.court_id
               WHERE c.name = 'Orphan Court' AND s.creator_id IS NULL AND s.weekday = 6);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'solo-futuro ha spento % serie (#92)', v_n;
  END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.lobby_series s JOIN public.courts c ON c.id = s.court_id
                 WHERE c.name = 'Orphan Court' AND s.creator_id IS NULL AND s.weekday = 6 AND s.active = true) THEN
    RAISE EXCEPTION 'serie futura spenta da solo-futuro (#92)';
  END IF;
END $$;

-- 56g-2. E (passata entro 28 giorni) spegne: riesce.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
UPDATE public.lobby_series SET active = false
WHERE id IN (SELECT s.id FROM public.lobby_series s JOIN public.courts c ON c.id = s.court_id
             WHERE c.name = 'Orphan Court' AND s.creator_id IS NULL AND s.weekday = 2);
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.lobby_series s JOIN public.courts c ON c.id = s.court_id
                 WHERE c.name = 'Orphan Court' AND s.creator_id IS NULL AND s.weekday = 2 AND s.active = false) THEN
    RAISE EXCEPTION 'kill-switch su occorrenza passata fallito (#92)';
  END IF;
END $$;

-- ================= 57. #92: generatore, idempotenza, DST, skip =================
-- `p_now` fissa il riferimento (il cron chiama senza argomenti = NOW()).
SET LOCAL request.jwt.claims = '';
DO $$
DECLARE
  v_spring_court UUID;
  v_fall_court UUID;
  v_overlap_court UUID;
  v_pending_court UUID;
BEGIN
  INSERT INTO public.courts (name, lat, lng, location, source, submitted_by, moderation_status, status)
  VALUES
    ('DST Spring Court', 41.918, 12.518, ST_SetSRID(ST_MakePoint(12.518,41.918),4326)::geography, 'community',
     '55555555-5555-5555-5555-555555555555','approved','active'),
    ('DST Fall Court', 41.919, 12.519, ST_SetSRID(ST_MakePoint(12.519,41.919),4326)::geography, 'community',
     '55555555-5555-5555-5555-555555555555','approved','active'),
    ('Overlap Court', 41.920, 12.520, ST_SetSRID(ST_MakePoint(12.520,41.920),4326)::geography, 'community',
     '55555555-5555-5555-5555-555555555555','approved','active'),
    ('Pending Gen Court', 41.921, 12.521, ST_SetSRID(ST_MakePoint(12.521,41.921),4326)::geography, 'community',
     '55555555-5555-5555-5555-555555555555','pending','active');
  SELECT id INTO v_spring_court FROM public.courts WHERE name = 'DST Spring Court';
  SELECT id INTO v_fall_court FROM public.courts WHERE name = 'DST Fall Court';
  SELECT id INTO v_overlap_court FROM public.courts WHERE name = 'Overlap Court';
  SELECT id INTO v_pending_court FROM public.courts WHERE name = 'Pending Gen Court';

  -- Domenica 10:00 (ora locale del campo), prima/dopo il cambio ora legale.
  INSERT INTO public.lobby_series (court_id, creator_id, weekday, time_of_day, duration_minutes, max_players)
  VALUES (v_spring_court, '55555555-5555-5555-5555-555555555555', 7, '10:00', 60, 10);
  INSERT INTO public.lobby_series (court_id, creator_id, weekday, time_of_day, duration_minutes, max_players)
  VALUES (v_fall_court, '55555555-5555-5555-5555-555555555555', 7, '10:00', 60, 10);

  -- Giovedi' 20:00 sul campo overlap; la singola del 19/11 copre uno slot.
  INSERT INTO public.lobby_series (court_id, creator_id, weekday, time_of_day, duration_minutes, max_players)
  VALUES (v_overlap_court, '55555555-5555-5555-5555-555555555555',
          EXTRACT(ISODOW FROM DATE '2026-11-19')::SMALLINT, '20:00', 60, 10);
  INSERT INTO public.lobbies (court_id, creator_id, start_time, max_players, status, duration_minutes)
  VALUES (v_overlap_court, '55555555-5555-5555-5555-555555555555',
          '2026-11-19 20:30:00+01'::timestamptz, 10, 'open', 30);

  -- Serie su corte pending: il generatore la salta (altrimenti
  -- `require_approved_court` abortirebbe il batch notturno).
  INSERT INTO public.lobby_series (court_id, creator_id, weekday, time_of_day)
  VALUES (v_pending_court, '55555555-5555-5555-5555-555555555555', 7, '10:00');

  -- Il generatore gira su TUTTE le serie attive: si congelano quelle dei
  -- blocchi 54/56 (gia' asserite), cosi' i conteggi sotto sono per-corte.
  UPDATE public.lobby_series SET active = false
  WHERE court_id NOT IN (SELECT id FROM public.courts
                         WHERE name IN ('DST Spring Court', 'DST Fall Court',
                                        'Overlap Court', 'Pending Gen Court'));
END $$;

-- 57a. Ora legale (scatto 29/03/2026): 2 domeniche, 10:00 Roma = 09:00Z
-- prima e 08:00Z dopo. Il rerun aggiunge zero righe (globale: tutto
-- idempotente allo stesso p_now).
DO $$
DECLARE
  v_n INTEGER;
BEGIN
  SELECT public.generate_series_occurrences('2026-03-20 12:00:00+00'::timestamptz) INTO v_n;
  IF v_n < 2 THEN
    RAISE EXCEPTION 'generate primavera: % righe (#92)', v_n;
  END IF;
  IF (SELECT count(*) FROM public.lobbies l JOIN public.courts c ON c.id = l.court_id
      WHERE c.name = 'DST Spring Court') <> 2 THEN
    RAISE EXCEPTION 'occorrenze primavera != 2 (#92)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lobbies l JOIN public.courts c ON c.id = l.court_id
                 WHERE c.name = 'DST Spring Court' AND l.start_time = '2026-03-22 09:00:00+00'::timestamptz) THEN
    RAISE EXCEPTION '22/03 non alle 09:00Z (10:00 Roma pre-DST) (#92)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lobbies l JOIN public.courts c ON c.id = l.court_id
                 WHERE c.name = 'DST Spring Court' AND l.start_time = '2026-03-29 08:00:00+00'::timestamptz) THEN
    RAISE EXCEPTION '29/03 non alle 08:00Z (10:00 Roma post-DST) (#92)';
  END IF;
  SELECT public.generate_series_occurrences('2026-03-20 12:00:00+00'::timestamptz) INTO v_n;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'rerun primavera: % righe, attese 0 (#92)', v_n;
  END IF;
END $$;

-- 57b. Ora solare (ritorno 25/10/2026): 10:00 Roma = 08:00Z prima, 09:00Z dopo.
DO $$
DECLARE
  v_n INTEGER;
BEGIN
  SELECT public.generate_series_occurrences('2026-10-15 12:00:00+00'::timestamptz) INTO v_n;
  IF v_n < 2 THEN
    RAISE EXCEPTION 'generate autunno: % righe (#92)', v_n;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lobbies l JOIN public.courts c ON c.id = l.court_id
                 WHERE c.name = 'DST Fall Court' AND l.start_time = '2026-10-18 08:00:00+00'::timestamptz) THEN
    RAISE EXCEPTION '18/10 non alle 08:00Z (10:00 Roma pre-fallback) (#92)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lobbies l JOIN public.courts c ON c.id = l.court_id
                 WHERE c.name = 'DST Fall Court' AND l.start_time = '2026-10-25 09:00:00+00'::timestamptz) THEN
    RAISE EXCEPTION '25/10 non alle 09:00Z (10:00 Roma post-fallback) (#92)';
  END IF;
  SELECT public.generate_series_occurrences('2026-10-15 12:00:00+00'::timestamptz) INTO v_n;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'rerun autunno: % righe, attese 0 (#92)', v_n;
  END IF;
END $$;

-- 57c. Overlap: sopra la singola del 19/11 non si genera; il 26/11 si'.
-- Pending: zero Occorrenze (skip, non errore).
DO $$
DECLARE
  v_n INTEGER;
BEGIN
  SELECT public.generate_series_occurrences('2026-11-18 12:00:00+00'::timestamptz) INTO v_n;
  IF v_n < 1 THEN
    RAISE EXCEPTION 'generate overlap: % righe (#92)', v_n;
  END IF;
  IF EXISTS (SELECT 1 FROM public.lobbies l JOIN public.courts c ON c.id = l.court_id
             WHERE c.name = 'Overlap Court' AND l.series_id IS NOT NULL
               AND l.start_time = '2026-11-19 19:00:00+00'::timestamptz) THEN
    RAISE EXCEPTION 'occorrenza generata sopra la singola (#92)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lobbies l JOIN public.courts c ON c.id = l.court_id
                 WHERE c.name = 'Overlap Court' AND l.series_id IS NOT NULL
                   AND l.start_time = '2026-11-26 19:00:00+00'::timestamptz) THEN
    RAISE EXCEPTION 'occorrenza del 26/11 mancante (#92)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.lobbies l JOIN public.courts c ON c.id = l.court_id
             WHERE c.name = 'Pending Gen Court' AND l.series_id IS NOT NULL) THEN
    RAISE EXCEPTION 'occorrenza su corte pending (#92)';
  END IF;
END $$;

-- 57d. Le Occorrenze nascono senza partecipanti (nessuna Conferma implicita)
-- e copiano creatore/sport/durata/capienza dalla Serie.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.lobby_participants lp JOIN public.lobbies l ON l.id = lp.lobby_id
             JOIN public.courts c ON c.id = l.court_id
             WHERE c.name IN ('DST Spring Court', 'DST Fall Court', 'Overlap Court')
               AND l.series_id IS NOT NULL) THEN
    RAISE EXCEPTION 'partecipanti precaricati sulle occorrenze (#92)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.lobbies l JOIN public.courts c ON c.id = l.court_id
             WHERE c.name IN ('DST Spring Court', 'DST Fall Court', 'Overlap Court')
               AND l.series_id IS NOT NULL
               AND (l.creator_id IS DISTINCT FROM '55555555-5555-5555-5555-555555555555'
                    OR l.duration_minutes <> 60 OR l.max_players <> 10)) THEN
    RAISE EXCEPTION 'occorrenze senza copia dei valori serie (#92)';
  END IF;
END $$;

-- 57e. Serie disattivata: il generatore la salta.
DO $$
DECLARE
  v_n INTEGER;
BEGIN
  UPDATE public.lobby_series SET active = false
  WHERE court_id = (SELECT id FROM public.courts WHERE name = 'DST Fall Court');
  SELECT public.generate_series_occurrences('2026-03-20 12:00:00+00'::timestamptz) INTO v_n;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'generate con serie spenta e slot noti: % righe (#92)', v_n;
  END IF;
END $$;

-- ================= 58. #92 addendum: materializzazione immediata =================
-- `materialize_series` (047, grant ad authenticated): solo il creatore;
-- `generate_series_one` (046) e `generate_series_occurrences` restano senza
-- EXECUTE (solo cron). Logica di generazione unica: stesse regole della 046.
SET LOCAL request.jwt.claims = '';
INSERT INTO auth.users (id, email) VALUES
  ('99999999-9999-9999-9999-999999999999','i@test.local');
DO $$
DECLARE
  v_court UUID;
BEGIN
  INSERT INTO public.courts (name, lat, lng, location, source, submitted_by, moderation_status, status)
  VALUES ('Materialize Court', 41.922, 12.522, ST_SetSRID(ST_MakePoint(12.522,41.922),4326)::geography, 'community',
          '99999999-9999-9999-9999-999999999999','approved','active')
  RETURNING id INTO v_court;
  -- weekday = oggi+3 giorni (Roma), ore 20:00: due slot futuri (+3, +10),
  -- entrambi dentro l'orizzonte 14 giorni qualunque sia l'ora di esecuzione.
  INSERT INTO public.lobby_series (court_id, creator_id, weekday, time_of_day, duration_minutes, max_players)
  VALUES (v_court, '99999999-9999-9999-9999-999999999999',
          EXTRACT(ISODOW FROM ((NOW() AT TIME ZONE 'Europe/Rome')::date + 3))::SMALLINT,
          '20:00', 60, 10);
END $$;

-- 58a. Il creatore materializza: 2 Occorrenze; il rerun e' un no-op (0).
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
DO $$
DECLARE
  v_n INTEGER;
  v_m INTEGER;
BEGIN
  SELECT public.materialize_series((SELECT id FROM public.lobby_series
    WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Materialize Court'))) INTO v_n;
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'materialize creatore: % righe, attese 2 (#92 addendum)', v_n;
  END IF;
  SELECT count(*) INTO v_m FROM public.lobbies l JOIN public.courts c ON c.id = l.court_id
  WHERE c.name = 'Materialize Court' AND l.series_id IS NOT NULL;
  IF v_m <> 2 THEN
    RAISE EXCEPTION 'materialize: % occorrenze, attese 2 (#92 addendum)', v_m;
  END IF;
  SELECT public.materialize_series((SELECT id FROM public.lobby_series
    WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Materialize Court'))) INTO v_n;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'materialize rerun: % righe, attese 0 (#92 addendum)', v_n;
  END IF;
END $$;
RESET ROLE;

-- 58b. Il non-creatore (E, anche da partecipante di un'Occorrenza)
-- -> insufficient_privilege (42501).
SET LOCAL request.jwt.claims = '';
DO $$ BEGIN
  INSERT INTO public.lobby_participants (lobby_id, user_id)
  SELECT l.id, '55555555-5555-5555-5555-555555555555' FROM public.lobbies l
  JOIN public.courts c ON c.id = l.court_id
  WHERE c.name = 'Materialize Court' AND l.series_id IS NOT NULL
  ORDER BY l.start_time ASC LIMIT 1;
END $$;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.materialize_series((SELECT id FROM public.lobby_series
      WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Materialize Court')));
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'materialize non-creatore: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'non-creatore ha materializzato (#92 addendum)';
END $$;
RESET ROLE;

-- 58c. anon -> permission denied (42501: nessun EXECUTE ad anon).
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
DO $$
BEGIN
  BEGIN
    PERFORM public.materialize_series((SELECT id FROM public.lobby_series
      WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Materialize Court')));
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'materialize anon: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'anon ha materializzato (#92 addendum)';
END $$;
RESET ROLE;

-- 58d. Serie disattivata: il creatore ottiene 0 righe, niente di nuovo.
SET LOCAL request.jwt.claims = '';
DO $$ BEGIN
  UPDATE public.lobby_series SET active = false
  WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Materialize Court');
END $$;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
DO $$
DECLARE
  v_n INTEGER;
  v_before INTEGER;
  v_after INTEGER;
BEGIN
  SELECT count(*) INTO v_before FROM public.lobbies l JOIN public.courts c ON c.id = l.court_id
  WHERE c.name = 'Materialize Court' AND l.series_id IS NOT NULL;
  SELECT public.materialize_series((SELECT id FROM public.lobby_series
    WHERE court_id = (SELECT id FROM public.courts WHERE name = 'Materialize Court'))) INTO v_n;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'materialize su serie spenta: % righe (#92 addendum)', v_n;
  END IF;
  SELECT count(*) INTO v_after FROM public.lobbies l JOIN public.courts c ON c.id = l.court_id
  WHERE c.name = 'Materialize Court' AND l.series_id IS NOT NULL;
  IF v_after <> v_before THEN
    RAISE EXCEPTION 'materialize su serie spenta ha creato righe (#92 addendum)';
  END IF;
END $$;
RESET ROLE;

-- 58e. Cron-path dopo il refactor: doppia chiamata globale, la seconda e'
-- zero righe (stessa idempotenza della 046 prima dell'estrazione).
SET LOCAL request.jwt.claims = '';
DO $$
DECLARE
  v_a INTEGER;
  v_b INTEGER;
BEGIN
  SELECT public.generate_series_occurrences() INTO v_a;
  SELECT public.generate_series_occurrences() INTO v_b;
  IF v_b <> 0 THEN
    RAISE EXCEPTION 'cron-path post-refactor: rerun % righe, attese 0 (#92 addendum)', v_b;
  END IF;
END $$;

-- 58f. Zero effetti su `lobby_participants`: solo la riga E di 58b.
DO $$ BEGIN
  IF (SELECT count(*) FROM public.lobby_participants lp JOIN public.lobbies l ON l.id = lp.lobby_id
      JOIN public.courts c ON c.id = l.court_id
      WHERE c.name = 'Materialize Court') <> 1 THEN
    RAISE EXCEPTION 'materialize ha toccato i partecipanti (#92 addendum)';
  END IF;
END $$;

-- ================= 59. #106: proposte nome campo =================
-- Fixture dedicate (nomi unici: il seed ne ha 10k, mai matchare per LIKE).
-- Alpha/Beta/Gamma approved con flag auto (come dopo il backfill 050);
-- Pending Court resta pending (proporre sopra -> P0001); Dup Target e'
-- l'obiettivo approved di mark_duplicate in 59n.
-- Utenti: A e' stata cancellata nel blocco 50 (#94) e mai ricreata, quindi
-- qui il proponente e' D (utenza fresca, profilo da handle_new_user); B
-- resta il moderatore, C lo spettatore/proponente secondario.
SET LOCAL request.jwt.claims = '';
INSERT INTO auth.users (id, email) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd','d@test.local');
INSERT INTO public.courts (name, lat, lng, location, source, moderation_status, status, is_auto_name)
VALUES
 ('NameProp Alpha Court', 41.92, 12.52, ST_SetSRID(ST_MakePoint(12.52,41.92),4326)::geography, 'osm', 'approved', 'active', true),
 ('NameProp Beta Court', 41.93, 12.53, ST_SetSRID(ST_MakePoint(12.53,41.93),4326)::geography, 'osm', 'approved', 'active', true),
 ('NameProp Gamma Court', 41.94, 12.54, ST_SetSRID(ST_MakePoint(12.54,41.94),4326)::geography, 'osm', 'approved', 'active', true),
 ('NameProp Pending Court', 41.95, 12.55, ST_SetSRID(ST_MakePoint(12.55,41.95),4326)::geography, 'community', 'pending', 'active', false),
 ('NameProp Dup Target', 41.96, 12.56, ST_SetSRID(ST_MakePoint(12.56,41.96),4326)::geography, 'osm', 'approved', 'active', false);

-- Setup: A propone 'Campetto Unico Sole' su Alpha (resta pending fino a 59i).
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated"}';
SELECT public.propose_court_name(
  (SELECT id FROM public.courts WHERE name = 'NameProp Alpha Court'), 'Campetto Unico Sole');
RESET ROLE;

-- 59a. anon non vede court_name_proposals (policy: zero righe, non errore).
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.court_name_proposals) THEN
    RAISE EXCEPTION 'anon vede court_name_proposals';
  END IF;
END $$;
RESET ROLE;

-- 59b. C (non proponente, non mod) non vede la pending di D (scoping su
-- fixture: mai EXISTS globale, altre righe visibili non devono interferire).
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.court_name_proposals
             WHERE proposed_name = 'Campetto Unico Sole') THEN
    RAISE EXCEPTION 'C vede la proposta di D';
  END IF;
END $$;
RESET ROLE;

-- 59c. D vede la sua pending e non le pending altrui (mai conteggi
-- globali: le righe visibili dipendono da policy e dati, non dalle fixture).
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated"}';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.court_name_proposals
                 WHERE proposer_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
                   AND proposed_name = 'Campetto Unico Sole' AND status = 'pending') THEN
    RAISE EXCEPTION 'D non vede la sua pending';
  END IF;
  IF EXISTS (SELECT 1 FROM public.court_name_proposals
             WHERE proposer_id <> 'dddddddd-dddd-dddd-dddd-dddddddddddd'
               AND status = 'pending') THEN
    RAISE EXCEPTION 'D vede pending altrui';
  END IF;
END $$;
RESET ROLE;

-- 59d. Nome proposto pendente: invisibile a ricerca/viewport, la corte
-- mostra ancora il vecchio nome con is_auto_name=true.
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.nearby_courts(41.92, 12.52, 2000, 200, NULL, 'Unico Sole')) THEN
    RAISE EXCEPTION 'p_search trova un nome proposto-pending';
  END IF;
  IF EXISTS (SELECT 1 FROM public.courts_in_viewport(12.515, 41.915, 12.525, 41.925)
             WHERE name = 'Campetto Unico Sole') THEN
    RAISE EXCEPTION 'viewport mostra un nome proposto-pending';
  END IF;
  -- Bbox stretta su Alpha: la bbox di Roma intera contiene i 10k seed e il
  -- LIMIT 2000 senza ordinamento taglierebbe la fixture a caso.
  IF NOT EXISTS (SELECT 1 FROM public.courts_in_viewport(12.515, 41.915, 12.525, 41.925)
                 WHERE name = 'NameProp Alpha Court') THEN
    RAISE EXCEPTION 'viewport non mostra piu la corte con proposta pending';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.nearby_courts(41.92, 12.52, 2000, 200)
                 WHERE name = 'NameProp Alpha Court' AND is_auto_name IS TRUE) THEN
    RAISE EXCEPTION 'nearby_courts non restituisce is_auto_name=true';
  END IF;
END $$;
RESET ROLE;

-- 59e. Seconda pending dello stesso utente sullo stesso campo -> P0001.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.propose_court_name(
      (SELECT id FROM public.courts WHERE name = 'NameProp Alpha Court'), 'Altro Nome Stesso Campo');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'doppia pending: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'doppia pending dello stesso utente riuscita';
END $$;
RESET ROLE;

-- 59f. Validazione propose: corte pending -> P0001...
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.propose_court_name(
      (SELECT id FROM public.courts WHERE name = 'NameProp Pending Court'), 'Nome Su Pending');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'propose su pending: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'propose su corte pending riuscita';
END $$;
RESET ROLE;
-- ...nome uguale all'attuale -> P0001...
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.propose_court_name(
      (SELECT id FROM public.courts WHERE name = 'NameProp Beta Court'), 'NameProp Beta Court');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'propose nome uguale: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'propose con nome uguale all attuale riuscita';
END $$;
RESET ROLE;
-- ...corte inesistente -> P0001...
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.propose_court_name('99999999-9999-9999-9999-999999999999', 'Nome Fantasma');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'propose su corte inesistente: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'propose su corte inesistente riuscita';
END $$;
RESET ROLE;
-- ...anon -> 42501.
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
DO $$
BEGIN
  BEGIN
    PERFORM public.propose_court_name(
      (SELECT id FROM public.courts WHERE name = 'NameProp Beta Court'), 'Nome Anonimo');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'propose anon: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'propose anonima riuscita';
END $$;
RESET ROLE;

-- 59g. C (non-mod) non approva -> 42501...
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.approve_name_proposal(
      (SELECT id FROM public.court_name_proposals WHERE proposed_name = 'Campetto Unico Sole'));
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'approve da non-mod: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'non-mod ha approvato';
END $$;
RESET ROLE;
-- ...e non rifiuta -> 42501.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.reject_name_proposal(
      (SELECT id FROM public.court_name_proposals WHERE proposed_name = 'Campetto Unico Sole'), 'no');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'reject da non-mod: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'non-mod ha rifiutato';
END $$;
RESET ROLE;

-- Setup 59h: C propone un secondo nome su Alpha (indice unico: una pending
-- per campo PER utente, due utenti diversi ok).
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
SELECT public.propose_court_name(
  (SELECT id FROM public.courts WHERE name = 'NameProp Alpha Court'), 'Altro Nome Unico');
RESET ROLE;

-- 59i. B (mod) approva la proposta di A: nome applicato, flag spento,
-- vincitrice approved, l'altra pending rigettata d'ufficio.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
SELECT public.approve_name_proposal(
  (SELECT id FROM public.court_name_proposals WHERE proposed_name = 'Campetto Unico Sole'));
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courts
                 WHERE name = 'Campetto Unico Sole' AND is_auto_name IS FALSE) THEN
    RAISE EXCEPTION 'approve non ha applicato il nome o spento il flag';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.court_name_proposals
                 WHERE proposed_name = 'Campetto Unico Sole' AND status = 'approved'
                   AND decided_by = '22222222-2222-2222-2222-222222222222') THEN
    RAISE EXCEPTION 'vincitrice non approved';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.court_name_proposals
                 WHERE proposed_name = 'Altro Nome Unico' AND status = 'rejected'
                   AND moderator_note = 'Un altro nome è stato approvato per questo campo.') THEN
    RAISE EXCEPTION 'altra pending non rejected d ufficio';
  END IF;
END $$;

-- 59j. Dopo l'approvazione: p_search trova il nome, is_auto_name=false,
-- il vecchio nome generico non matcha piu' Alpha.
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.nearby_courts(41.92, 12.52, 2000, 200, NULL, 'Unico Sole')
                 WHERE name = 'Campetto Unico Sole' AND is_auto_name IS FALSE) THEN
    RAISE EXCEPTION 'p_search non trova il nome approvato o flag non spento';
  END IF;
  IF EXISTS (SELECT 1 FROM public.nearby_courts(41.92, 12.52, 2000, 200, NULL, 'NameProp Alpha')
             WHERE name = 'Campetto Unico Sole') THEN
    RAISE EXCEPTION 'vecchio nome ancora associato ad Alpha';
  END IF;
END $$;
RESET ROLE;

-- 59k. Approva-con-modifica: B approva la proposta di A su Beta passando
-- l'override; la corte prende il nome corretto.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated"}';
SELECT public.propose_court_name(
  (SELECT id FROM public.courts WHERE name = 'NameProp Beta Court'), 'Nome Base Unico');
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
SELECT public.approve_name_proposal(
  (SELECT id FROM public.court_name_proposals WHERE proposed_name = 'Nome Base Unico'),
  'Nome Corretto Unico');
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courts
                 WHERE name = 'Nome Corretto Unico' AND is_auto_name IS FALSE) THEN
    RAISE EXCEPTION 'approve-con-modifica non applicata';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.court_name_proposals
                 WHERE proposed_name = 'Nome Corretto Unico' AND status = 'approved') THEN
    RAISE EXCEPTION 'proposta non aggiornata con override';
  END IF;
END $$;

-- 59l. Ritiro: A propone e ritira (withdrawn); secondo ritiro -> 42501;
-- ritiro di proposta altrui -> 42501.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated"}';
SELECT public.propose_court_name(
  (SELECT id FROM public.courts WHERE name = 'Nome Corretto Unico'), 'Nome Ritirato Unico');
SELECT public.withdraw_name_proposal(
  (SELECT id FROM public.court_name_proposals WHERE proposed_name = 'Nome Ritirato Unico'));
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.court_name_proposals
                 WHERE proposed_name = 'Nome Ritirato Unico' AND status = 'withdrawn') THEN
    RAISE EXCEPTION 'withdraw non applicato';
  END IF;
END $$;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.withdraw_name_proposal(
      (SELECT id FROM public.court_name_proposals WHERE proposed_name = 'Nome Ritirato Unico'));
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'doppio withdraw: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'doppio ritiro riuscito';
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated"}';
SELECT public.propose_court_name(
  (SELECT id FROM public.courts WHERE name = 'Nome Corretto Unico'), 'Nome Altrui Unico');
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.withdraw_name_proposal(
      (SELECT id FROM public.court_name_proposals WHERE proposed_name = 'Nome Altrui Unico'));
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'withdraw altrui: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'ritiro di proposta altrui riuscito';
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated"}';
SELECT public.withdraw_name_proposal(
  (SELECT id FROM public.court_name_proposals WHERE proposed_name = 'Nome Altrui Unico'));
RESET ROLE;

-- 59m. Rifiuto: nota obbligatoria (NULL -> P0001), poi rifiuto con nota.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
SELECT public.propose_court_name(
  (SELECT id FROM public.courts WHERE name = 'Nome Corretto Unico'), 'Nome Brutto Unico');
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.reject_name_proposal(
      (SELECT id FROM public.court_name_proposals WHERE proposed_name = 'Nome Brutto Unico'), NULL);
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'reject senza nota: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'rifiuto senza nota riuscito';
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
SELECT public.reject_name_proposal(
  (SELECT id FROM public.court_name_proposals WHERE proposed_name = 'Nome Brutto Unico'),
  'Nome offensivo.');
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.court_name_proposals
                 WHERE proposed_name = 'Nome Brutto Unico' AND status = 'rejected'
                   AND moderator_note = 'Nome offensivo.'
                   AND decided_by = '22222222-2222-2222-2222-222222222222') THEN
    RAISE EXCEPTION 'reject con nota non applicato';
  END IF;
  IF EXISTS (SELECT 1 FROM public.courts WHERE name = 'Nome Brutto Unico') THEN
    RAISE EXCEPTION 'rifiuto ha cambiato il nome della corte';
  END IF;
END $$;

-- 59n. Chiusura d'ufficio: Gamma diventa duplicata -> pending rigettata con
-- nota automatica (trigger, non estensione degli RPC).
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
SELECT public.propose_court_name(
  (SELECT id FROM public.courts WHERE name = 'NameProp Gamma Court'), 'Nome Orfano Unico');
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
SELECT public.mark_duplicate(
  (SELECT id FROM public.courts WHERE name = 'NameProp Gamma Court'),
  (SELECT id FROM public.courts WHERE name = 'NameProp Dup Target'));
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.court_name_proposals
                 WHERE proposed_name = 'Nome Orfano Unico' AND status = 'rejected'
                   AND moderator_note LIKE '%duplicato%' AND decided_by IS NULL) THEN
    RAISE EXCEPTION 'chiusura d ufficio non applicata';
  END IF;
END $$;

-- ================= 60. #90: note di campo =================
-- Fixture dedicate (nomi unici: il seed ne ha 10k, mai matchare per LIKE).
-- Tre corti in tre stati; le note su pending/rejected le scrive postgres
-- (bypassa RLS) perche' add_court_note accetta solo corti approved.
-- Utenti: B resta il moderatore, C il non-mod.
SET LOCAL request.jwt.claims = '';
INSERT INTO public.courts (name, lat, lng, location, source, moderation_status, status)
VALUES
 ('CourtNote Approved Court', 41.70, 12.40, ST_SetSRID(ST_MakePoint(12.40,41.70),4326)::geography, 'osm', 'approved', 'active'),
 ('CourtNote Pending Court', 41.71, 12.41, ST_SetSRID(ST_MakePoint(12.41,41.71),4326)::geography, 'community', 'pending', 'active'),
 ('CourtNote Rejected Court', 41.72, 12.42, ST_SetSRID(ST_MakePoint(12.42,41.72),4326)::geography, 'community', 'rejected', 'active');
INSERT INTO public.court_notes (court_id, author_id, kind, body)
VALUES
 ((SELECT id FROM public.courts WHERE name = 'CourtNote Pending Court'),
  '22222222-2222-2222-2222-222222222222', 'closed', 'Nota pending invisibile'),
 ((SELECT id FROM public.courts WHERE name = 'CourtNote Rejected Court'),
  '22222222-2222-2222-2222-222222222222', 'closed', 'Nota rejected invisibile');

-- 60a. B (mod) aggiunge una nota senza testo su corte approved.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
SELECT public.add_court_note(
  (SELECT id FROM public.courts WHERE name = 'CourtNote Approved Court'),
  'broken_hoop', NULL);
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.court_notes
                 WHERE kind = 'broken_hoop' AND body IS NULL
                   AND author_id = '22222222-2222-2222-2222-222222222222'
                   AND court_id = (SELECT id FROM public.courts
                                   WHERE name = 'CourtNote Approved Court')) THEN
    RAISE EXCEPTION 'add_court_note non ha scritto la nota';
  END IF;
END $$;

-- 60b. anon legge la nota della corte approved (scoping su fixture:
-- mai matchare per solo kind, una nota estranea farebbe passare il test).
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.court_notes n
                 WHERE n.court_id = (SELECT id FROM public.courts
                                     WHERE name = 'CourtNote Approved Court')
                   AND n.author_id = '22222222-2222-2222-2222-222222222222'
                   AND n.kind = 'broken_hoop' AND n.body IS NULL) THEN
    RAISE EXCEPTION 'anon non vede la nota di corte approved';
  END IF;
END $$;
RESET ROLE;

-- 60c. ...ma NON quelle di corti pending/rejected.
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.court_notes WHERE body = 'Nota pending invisibile') THEN
    RAISE EXCEPTION 'anon vede nota di corte pending';
  END IF;
  IF EXISTS (SELECT 1 FROM public.court_notes WHERE body = 'Nota rejected invisibile') THEN
    RAISE EXCEPTION 'anon vede nota di corte rejected';
  END IF;
  IF EXISTS (SELECT 1 FROM public.court_notes n
             JOIN public.courts c ON c.id = n.court_id
             WHERE c.moderation_status <> 'approved') THEN
    RAISE EXCEPTION 'anon vede note di corti non approved';
  END IF;
END $$;
RESET ROLE;

-- 60d. C (non-mod) non scrive: add/edit/delete -> 42501.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.add_court_note(
      (SELECT id FROM public.courts WHERE name = 'CourtNote Approved Court'),
      'closed', 'tentativo');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'add da non-mod: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'non-mod ha aggiunto una nota';
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.edit_court_note(
      (SELECT id FROM public.court_notes
        WHERE kind = 'broken_hoop'
          AND court_id = (SELECT id FROM public.courts WHERE name = 'CourtNote Approved Court')
          AND author_id = '22222222-2222-2222-2222-222222222222'),
      'closed', 'tentativo');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'edit da non-mod: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'non-mod ha modificato una nota';
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.delete_court_note(
      (SELECT id FROM public.court_notes
        WHERE kind = 'broken_hoop'
          AND court_id = (SELECT id FROM public.courts WHERE name = 'CourtNote Approved Court')
          AND author_id = '22222222-2222-2222-2222-222222222222'));
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'delete da non-mod: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'non-mod ha cancellato una nota';
END $$;
RESET ROLE;

-- 60e. anon non scrive (add -> 42501) e non scrive diretto (INSERT -> 42501:
-- nessuna policy DML, solo RPC).
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
DO $$
BEGIN
  BEGIN
    PERFORM public.add_court_note(
      (SELECT id FROM public.courts WHERE name = 'CourtNote Approved Court'),
      'closed', 'tentativo');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'add da anon: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'anon ha aggiunto una nota';
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    INSERT INTO public.court_notes (court_id, author_id, kind)
    VALUES ((SELECT id FROM public.courts WHERE name = 'CourtNote Approved Court'),
            '33333333-3333-3333-3333-333333333333', 'other');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'insert diretta: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'insert diretta su court_notes riuscita';
END $$;
RESET ROLE;

-- 60f. Validazione add (B mod): kind fuori allowlist -> P0001...
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.add_court_note(
      (SELECT id FROM public.courts WHERE name = 'CourtNote Approved Court'),
      'campo_magnetico', 'tentativo');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'kind fuori allowlist: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'kind fuori allowlist accettato';
END $$;
RESET ROLE;
-- ...body >200 -> P0001...
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.add_court_note(
      (SELECT id FROM public.courts WHERE name = 'CourtNote Approved Court'),
      'other', repeat('x', 201));
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'body >200: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'body oltre 200 caratteri accettato';
END $$;
RESET ROLE;
-- ...corte pending -> P0001, corte inesistente -> P0001.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.add_court_note(
      (SELECT id FROM public.courts WHERE name = 'CourtNote Pending Court'),
      'closed', 'tentativo');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'add su pending: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'add su corte pending riuscita';
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.add_court_note('99999999-9999-9999-9999-999999999999', 'closed', 'tentativo');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'add su corte inesistente: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'add su corte inesistente riuscita';
END $$;
RESET ROLE;

-- 60g. Body blank ('   ') = nota senza testo: scritta con body NULL.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
SELECT public.add_court_note(
  (SELECT id FROM public.courts WHERE name = 'CourtNote Approved Court'),
  'surface', '   ');
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.court_notes
                 WHERE kind = 'surface' AND body IS NULL
                   AND court_id = (SELECT id FROM public.courts
                                   WHERE name = 'CourtNote Approved Court')
                   AND author_id = '22222222-2222-2222-2222-222222222222') THEN
    RAISE EXCEPTION 'body blank non normalizzato a NULL';
  END IF;
END $$;

-- 60h. B modifica la nota: kind+body aggiornati; kind invalido -> P0001;
-- nota inesistente -> P0001.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
SELECT public.add_court_note(
  (SELECT id FROM public.courts WHERE name = 'CourtNote Approved Court'),
  'other', 'Nota Unica Alfa');
SELECT public.edit_court_note(
  (SELECT id FROM public.court_notes WHERE body = 'Nota Unica Alfa'),
  'no_lighting', 'Nota Unica Beta');
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.court_notes
                 WHERE kind = 'no_lighting' AND body = 'Nota Unica Beta') THEN
    RAISE EXCEPTION 'edit non applicato';
  END IF;
END $$;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.edit_court_note(
      (SELECT id FROM public.court_notes WHERE body = 'Nota Unica Beta'),
      'campo_magnetico', 'tentativo');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'edit kind invalido: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'edit con kind invalido riuscito';
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.edit_court_note('99999999-9999-9999-9999-999999999999', 'closed', 'x');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'edit inesistente: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'edit di nota inesistente riuscita';
END $$;
RESET ROLE;

-- 60i. B cancella la nota; seconda cancellazione -> P0001.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
SELECT public.delete_court_note(
  (SELECT id FROM public.court_notes WHERE body = 'Nota Unica Beta'));
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.court_notes WHERE body = 'Nota Unica Beta') THEN
    RAISE EXCEPTION 'delete non applicata';
  END IF;
END $$;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.delete_court_note('99999999-9999-9999-9999-999999999999');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'doppia delete: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'doppia cancellazione riuscita';
END $$;
RESET ROLE;

-- 60j. La corte con nota resta visibile in ricerca e viewport (le RPC di
-- lettura non si toccano: la nota non nasconde il campo).
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.nearby_courts(41.70, 12.40, 2000, 200)
                 WHERE name = 'CourtNote Approved Court') THEN
    RAISE EXCEPTION 'nearby_courts non mostra piu la corte con nota';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.courts_in_viewport(12.39, 41.69, 12.41, 41.71)
                 WHERE name = 'CourtNote Approved Court') THEN
    RAISE EXCEPTION 'viewport non mostra piu la corte con nota';
  END IF;
END $$;
RESET ROLE;

-- 60k. Slug italiani della 052 rifiutati (053): il vecchio 'canestro_rotto'
-- non e' piu' nell'allowlist -> P0001. 'other' senza testo -> P0001
-- (decisione 9 della spec); body di 200 caratteri accettato, 201 no.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.add_court_note(
      (SELECT id FROM public.courts WHERE name = 'CourtNote Approved Court'),
      'canestro_rotto', 'tentativo');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'vecchio slug italiano: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'vecchio slug italiano canestro_rotto accettato';
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.add_court_note(
      (SELECT id FROM public.courts WHERE name = 'CourtNote Approved Court'),
      'other', NULL);
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'other senza testo: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'other senza testo accettato';
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.add_court_note(
      (SELECT id FROM public.courts WHERE name = 'CourtNote Approved Court'),
      'other', '   ');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'other con blank: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'other con body blank accettato';
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
SELECT public.add_court_note(
  (SELECT id FROM public.courts WHERE name = 'CourtNote Approved Court'),
  'surface', repeat('y', 200));
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.court_notes
                 WHERE kind = 'surface' AND char_length(body) = 200
                   AND court_id = (SELECT id FROM public.courts
                                   WHERE name = 'CourtNote Approved Court')
                   AND author_id = '22222222-2222-2222-2222-222222222222') THEN
    RAISE EXCEPTION 'body di 200 caratteri rifiutato';
  END IF;
END $$;

-- ================= 61. #89 lane A: open_lobbies espone series_id =================
-- Il foglio home deve mostrare il chip "Ricorrente" (#92) come /lobbies: la
-- RPC aggiunge `series_id` in coda (migrazione 054, regola additiva
-- docs/rpc.md). Fixture isolata su corte dedicata 'Series Chip Court'
-- (approved/active come la 35, cosi' anon la vede): un'occorrenza di serie
-- dentro le 36h, una singola dentro le 36h, un'occorrenza di serie a +10
-- giorni. Ultimo blocco: dopo la 60 nulla segue, nessun'altra fixture
-- dipende da questi nomi. Claim azzerati (come 58/59): gli INSERT girano
-- come postgres e il rate-limit 034 (chiave su auth.uid) non scatta.
SET LOCAL request.jwt.claims = '';
DO $$
DECLARE
  v_court UUID;
  v_series UUID;
BEGIN
  INSERT INTO public.courts (name, lat, lng, location, source, submitted_by, moderation_status, status)
  VALUES ('Series Chip Court', 41.92, 12.52, ST_SetSRID(ST_MakePoint(12.52,41.92),4326)::geography, 'community',
          'dddddddd-dddd-dddd-dddd-dddddddddddd','approved','active')
  RETURNING id INTO v_court;
  INSERT INTO public.lobby_series (court_id, creator_id, weekday, time_of_day, duration_minutes, max_players)
  VALUES (v_court, 'dddddddd-dddd-dddd-dddd-dddddddddddd', 4, '20:00', 60, 10)
  RETURNING id INTO v_series;
  INSERT INTO public.lobbies (court_id, creator_id, start_time, max_players, status, duration_minutes, series_id)
  VALUES (v_court, 'dddddddd-dddd-dddd-dddd-dddddddddddd', now() + interval '2 hours', 10, 'open', 60, v_series);
  INSERT INTO public.lobbies (court_id, creator_id, start_time, max_players, status, series_id)
  VALUES (v_court, 'dddddddd-dddd-dddd-dddd-dddddddddddd', now() + interval '3 hours', 10, 'open', NULL);
  INSERT INTO public.lobbies (court_id, creator_id, start_time, max_players, status, duration_minutes, series_id)
  VALUES (v_court, 'dddddddd-dddd-dddd-dddd-dddddddddddd', now() + interval '10 days', 10, 'open', 60, v_series);
END $$;

-- 61a. L'occorrenza di serie espone series_id non nullo, la singola NULL
-- (coordinate sulla corte + raggio stretto: le sue righe escono per prime
-- in KNN, il WHERE sul nome resta dentro il LIMIT).
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.open_lobbies(NULL, 100, 41.92, 12.52, 2000)
                 WHERE court_name = 'Series Chip Court' AND series_id IS NOT NULL) THEN
    RAISE EXCEPTION 'open_lobbies non espone series_id sulle occorrenze (#89 lane A)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.open_lobbies(NULL, 100, 41.92, 12.52, 2000)
                 WHERE court_name = 'Series Chip Court' AND series_id IS NULL) THEN
    RAISE EXCEPTION 'open_lobbies: la singola non ha series_id NULL (#89 lane A)';
  END IF;
END $$;
RESET ROLE;

-- 61b. Stesso per authenticated (grant EXECUTE intatto dopo il DROP della 054).
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated"}';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.open_lobbies(NULL, 100, 41.92, 12.52, 2000)
                 WHERE court_name = 'Series Chip Court' AND series_id IS NOT NULL) THEN
    RAISE EXCEPTION 'open_lobbies(auth): series_id illeggibile (#89 lane A)';
  END IF;
END $$;
RESET ROLE;

-- 61c. Filtro 36h invariato: l'occorrenza a +10 giorni non compare (raggio
-- largo apposta: se uscisse, sarebbe solo l'orizzonte a escluderla).
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.open_lobbies(NULL, 100, 41.92, 12.52, 50000)
             WHERE court_name = 'Series Chip Court'
               AND start_time > NOW() + INTERVAL '36 hours') THEN
    RAISE EXCEPTION 'open_lobbies: orizzonte 36h rotto dalla 054 (#89 lane A)';
  END IF;
END $$;
RESET ROLE;

-- ================= 62. #84/055: quote giornaliere da tabella, per utente =================
-- Utenti freschi Q/R (mai usati prima: i loro bucket partono vuoti). Mai
-- count(*) su tutta rate_limit_events: solo EXISTS mirati e generate_series.
SET LOCAL request.jwt.claims = '';
INSERT INTO auth.users (id, email) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','q@test.local'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff','r@test.local');
INSERT INTO public.courts (name, lat, lng, location, source, moderation_status, status)
VALUES ('Daily Quota Court', 41.918, 12.518, ST_SetSRID(ST_MakePoint(12.518,41.918),4326)::geography,
        'community', 'approved', 'active');

-- 62a. Q riempie la quota segnalazioni (10/giorno da seed): 10 passano…
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","role":"authenticated"}';
INSERT INTO public.court_reports (court_id, user_id, category, expires_at)
SELECT (SELECT id FROM public.courts WHERE name = 'Daily Quota Court'),
       'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
       'other',
       now() + interval '1 hour'
FROM generate_series(1, 10);
RESET ROLE;

-- …l'undicesima cade in P0001 col testo giornaliero (nome azione incluso)…
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    INSERT INTO public.court_reports (court_id, user_id, category, expires_at)
    VALUES ((SELECT id FROM public.courts WHERE name = 'Daily Quota Court'),
            'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
            'other',
            now() + interval '1 hour');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN
      IF SQLERRM NOT LIKE '%giornaliero%di segnalazioni%' THEN
        RAISE EXCEPTION 'quota segnalazioni: messaggio senza nome azione: %', SQLERRM;
      END IF;
      RETURN;
    END IF;
    RAISE EXCEPTION 'quota segnalazioni: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'undicesima segnalazione di Q accettata (quota assente?)';
END $$;
RESET ROLE;

-- …ma R è indipendente: la sua prima segnalazione passa (finestra per
-- (bucket, utente), come la 034).
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"ffffffff-ffff-ffff-ffff-ffffffffffff","role":"authenticated"}';
INSERT INTO public.court_reports (court_id, user_id, category, expires_at)
VALUES ((SELECT id FROM public.courts WHERE name = 'Daily Quota Court'),
        'ffffffff-ffff-ffff-ffff-ffffffffffff',
        'other',
        now() + interval '1 hour');
RESET ROLE;

-- 62b. Bypass moderatori: B (moderatore dal setup) oltrepassa la quota senza
-- lasciare eventi — chi cura i campi non si blocca da solo.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
INSERT INTO public.court_reports (court_id, user_id, category, expires_at)
SELECT (SELECT id FROM public.courts WHERE name = 'Daily Quota Court'),
       '22222222-2222-2222-2222-222222222222',
       'other',
       now() + interval '1 hour'
FROM generate_series(1, 11);
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.rate_limit_events
             WHERE bucket = 'court_reports'
               AND subject = '22222222-2222-2222-2222-222222222222'
               AND created_at > now() - interval '24 hours') THEN
    RAISE EXCEPTION 'moderatore oltre quota ha lasciato eventi';
  END IF;
END $$;

-- 62c. La tabella quote è chiusa ai client come gli eventi (034:42-48).
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM max_per_day FROM public.rate_limit_quotas LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN RETURN; END IF;
    RAISE EXCEPTION 'rate_limit_quotas: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'rate_limit_quotas leggibile dal client (grant mancante?)';
END $$;
RESET ROLE;

-- ================= 63. #84/055: i numeri vivono fuori dal codice =================
-- UPDATE della quota -> il comportamento cambia senza toccare funzioni.
UPDATE public.rate_limit_quotas SET max_per_day = 1 WHERE bucket = 'court_reports';

-- R (1 segnalazione nel blocco 62) è ora già oltre la nuova quota…
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"ffffffff-ffff-ffff-ffff-ffffffffffff","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    INSERT INTO public.court_reports (court_id, user_id, category, expires_at)
    VALUES ((SELECT id FROM public.courts WHERE name = 'Daily Quota Court'),
            'ffffffff-ffff-ffff-ffff-ffffffffffff',
            'other',
            now() + interval '1 hour');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'quota abbassata: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'quota abbassata a 1 ma R scrive ancora';
END $$;
RESET ROLE;

-- …e rialzandola torna tutto come prima (il file è un'unica transazione con
-- ROLLBACK finale: il seed resta quello della 055).
UPDATE public.rate_limit_quotas SET max_per_day = 10 WHERE bucket = 'court_reports';
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"ffffffff-ffff-ffff-ffff-ffffffffffff","role":"authenticated"}';
INSERT INTO public.court_reports (court_id, user_id, category, expires_at)
VALUES ((SELECT id FROM public.courts WHERE name = 'Daily Quota Court'),
        'ffffffff-ffff-ffff-ffff-ffffffffffff',
        'other',
        now() + interval '1 hour');
RESET ROLE;

ROLLBACK;
