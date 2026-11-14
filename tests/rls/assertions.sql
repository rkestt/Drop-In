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

-- ================= 11. secondo submit entro un'ora -> P0001 (rate limit) =================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
SELECT public.submit_court('Test Court', 41.91, 12.51);
DO $$
BEGIN
  BEGIN
    PERFORM public.submit_court('Test Court 2', 41.92, 12.52);
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN RETURN; END IF;
    RAISE EXCEPTION 'rate limit: SQLSTATE % anomalo: %', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'second submit succeeded';
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

-- 27c. anon non aggiorna: read_at invariato.
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '';
UPDATE public.push_notifications SET read_at = NOW() WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
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
DO $$ DECLARE v TEXT[]; BEGIN
  SELECT COALESCE(array_agg(u.name ORDER BY u.ord), '{}') INTO v
  FROM pg_proc p
  JOIN LATERAL unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS u(name, mode, ord) ON true
  WHERE p.pronamespace = 'public'::regnamespace
    AND p.proname = 'courts_in_viewport'
    AND u.mode IN ('o', 'b', 't');
  IF v <> ARRAY['id','name','lat','lng','address','surface_type','hoop_count',
                'status','sport','venue_type','source','photo_path','moderation_status'] THEN
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

-- ================= 38. #26/027: la chiusura di una lobby penalizza e notifica =================
-- La 007 aveva perso l'INSERT in push_notifications: qui si fissa il
-- comportamento ripristinato dalla 027 (delta karma -3 + riga karma_loss),
-- altrimenti la sezione karma della storia del profilo resta vuota per
-- costruzione e nessun test se ne accorge.
-- Fixture dedicata (corte nuova + utente C): i blocchi sopra lasciano su A
-- check-in attivi che escluderebbero la penalita' (il predicato e' "nessun
-- check-in attivo sulla corte della lobby").
DO $$
DECLARE
  v_court UUID;
  v_lobby UUID;
  v_before INTEGER;
  v_after INTEGER;
  v_note_count BIGINT;
BEGIN
  INSERT INTO public.courts (name, lat, lng, location, source, moderation_status, status, sport)
  VALUES ('Karma Court', 41.905, 12.505,
          ST_SetSRID(ST_MakePoint(12.505, 41.905), 4326)::geography,
          'community', 'approved', 'active', NULL)
  RETURNING id INTO v_court;

  INSERT INTO public.lobbies (court_id, creator_id, start_time, max_players, status)
  VALUES (v_court, '33333333-3333-3333-3333-333333333333', now() - interval '3 hours', 10, 'open')
  RETURNING id INTO v_lobby;

  INSERT INTO public.lobby_participants (lobby_id, user_id)
  VALUES (v_lobby, '33333333-3333-3333-3333-333333333333');

  SELECT karma_score INTO v_before FROM public.profiles
  WHERE user_id = '33333333-3333-3333-3333-333333333333';

  UPDATE public.lobbies SET status = 'closed' WHERE id = v_lobby;

  SELECT karma_score INTO v_after FROM public.profiles
  WHERE user_id = '33333333-3333-3333-3333-333333333333';
  IF v_after <> v_before - 3 THEN
    RAISE EXCEPTION 'karma dopo la chiusura: % -> % (atteso -3)', v_before, v_after;
  END IF;

  SELECT count(*) INTO v_note_count
  FROM public.push_notifications
  WHERE user_id = '33333333-3333-3333-3333-333333333333'
    AND data->>'type' = 'karma_loss'
    AND (data->>'lobby_id')::uuid = v_lobby;
  IF v_note_count <> 1 THEN
    RAISE EXCEPTION 'notifiche karma_loss per la lobby: % (atteso 1)', v_note_count;
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
-- in 031). Ogni submit riuscito consuma il rate limit 1/ora, quindi i due
-- casi positivi usano utenti dedicati (D/E); i negativi non scrivono righe
-- e riusano F.
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
ROLLBACK;
