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

ROLLBACK;
