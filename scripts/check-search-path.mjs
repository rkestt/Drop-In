// scripts/check-search-path.mjs — guardrail #102: ogni funzione plpgsql/sql in
// `public` usata da un trigger su tabelle `public`, e ogni funzione SECURITY
// DEFINER chiamabile, deve pinnare il proprio search_path
// (`SET search_path = ...`, visibile in `proconfig`).
//
// Perche': un trigger gira con lo search_path del chiamante. La cascata di
// `auth.admin.deleteUser` gira come `supabase_auth_admin` (search_path solo
// `auth`): un riferimento non qualificato (`FROM courts`, `ST_MakePoint`,
// `type geography`) esplode con 500 e la cancellazione account fallisce
// sempre. Caso reale: `trigger_update_court_location`, pin in 043.
//
// Il controllo cerca `public` nel VALORE di search_path, non la sola
// presenza del parametro: un pin inutile (`SET search_path = ''`,
// `= pg_catalog`) non contiene `public` e viene segnalato come mancante.
// Limite: vale il contenimento, non l'ordine ne' l'esclusivita' —
// `public, extensions` e `"$user", public` passano entrambi.
//
// Prova manuale (DB locale acceso):
//   C=$(docker ps --format '{{.Names}}' | grep supabase_db | head -1)
//   docker exec -i $C psql -U postgres -d postgres -c \
//     "CREATE FUNCTION public.tmp_search_path_probe() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS \$\$ BEGIN NULL; END \$\$;"
//   npm run check:search-path   # deve segnalare public.tmp_search_path_probe
//   docker exec -i $C psql -U postgres -d postgres -c \
//     "DROP FUNCTION public.tmp_search_path_probe;"
//   (stessa funzione con SET search_path = public, extensions → deve passare)
//
// Uso: node scripts/check-search-path.mjs (zero dipendenze).
// Legge il catalogo del DB locale via docker exec (stesso pattern di
// `npm run test:rls`); se il container non e' su FALLISCE con messaggio
// chiaro, mai verde silenzioso. Override per test: SUPABASE_DB_CONTAINER=nome.
import { execSync } from "node:child_process";

const CONTAINER =
  process.env.SUPABASE_DB_CONTAINER ||
  (() => {
    try {
      const out = execSync(
        "docker ps --format '{{.Names}}' | grep supabase_db | head -1",
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
      ).trim();
      return out || null;
    } catch {
      return null;
    }
  })();

if (!CONTAINER) {
  console.error(
    "check-search-path: FALLITO — container supabase_db non trovato.\n" +
      "Avvia il DB locale (`npx supabase start`) e riprova: senza catalogo " +
      "il controllo non puo' dare verde."
  );
  process.exit(1);
}

function psql(sql) {
  const oneLine = sql.replace(/\s+/g, " ").trim();
  try {
    return execSync(
      `docker exec -i ${CONTAINER} psql -U postgres -d postgres -At -v ON_ERROR_STOP=1 -c ${JSON.stringify(oneLine)}`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
  } catch (e) {
    console.error(
      `check-search-path: FALLITO — psql sul container ${CONTAINER} non riuscito.\n` +
        (e.stderr?.trim() || e.message)
    );
    process.exit(1);
  }
}

// Funzioni trigger (plpgsql/sql in public) su tabelle public senza pin.
const triggerRows = psql(`
SELECT DISTINCT n.nspname || '.' || p.proname AS fn, c.relname AS tbl
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace ns ON ns.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
WHERE NOT t.tgisinternal
  AND ns.nspname = 'public' AND n.nspname = 'public'
  AND l.lanname IN ('plpgsql', 'sql')
  AND (p.proconfig IS NULL OR NOT array_to_string(p.proconfig, ',') ~ 'search_path=.*public')
ORDER BY 1, 2;`);

// DEFINER chiamabili (plpgsql/sql in public) senza pin. `handle_new_user` e'
// anche funzione trigger ma su auth.users: la prende questa seconda query.
const definerRows = psql(`
SELECT n.nspname || '.' || p.proname AS fn
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
WHERE n.nspname = 'public' AND p.prosecdef
  AND l.lanname IN ('plpgsql', 'sql')
  AND (p.proconfig IS NULL OR NOT array_to_string(p.proconfig, ',') ~ 'search_path=.*public')
ORDER BY 1;`);

// Allowlist SOLO per funzioni esistenti e innocue, motivo accanto a ognuna.
// Niente voci preventive: una funzione NUOVA senza pin deve far fallire il gate.
const ALLOWLIST = new Map([
  ["public.enforce_ban_on_low_karma", "solo NEW/NOW(), nessun riferimento a tabelle o funzioni"],
  ["public.guard_court_text_spam", "solo NEW + regex, nessun riferimento al catalogo"],
  ["public.guard_participant_reconfirm", "NEW/OLD + solo public.lobbies qualificato + NOW()"],
  ["public.guard_profile_moderator", "NEW/OLD + current_setting, nessuna tabella"],
  ["public.guard_profile_self_service", "NEW/OLD + current_setting/pg_trigger_depth/auth.uid() qualificato"],
  ["public.restrict_court_reviews_update", "NEW/OLD + current_setting, nessuna tabella"],
  ["public.restrict_push_notifications_update", "NEW/OLD + current_setting + jsonb_* (pg_catalog)"],
  ["public.update_updated_at_column", "solo NEW/NOW()"],
  ["public.handle_new_user", "DEFINER ma corpo solo NEW + public.profiles qualificato (trigger su auth.users)"],
]);

// Debito noto #102: saldato con la 048 (pin search_path sulle 4 funzioni
// INSERT/UPDATE-only). La mappa resta come struttura: una voce nuova qui va
// motivata riga per riga (perche' e' innocua e quando verra' pinnata) — mai
// voci preventive, una funzione NUOVA senza pin deve far fallire il gate.
const KNOWN_DEBT = new Map([]);

const errors = [];
const debt = [];
for (const line of triggerRows.trim().split("\n").filter(Boolean)) {
  const [fn, tbl] = line.split("|");
  if (ALLOWLIST.has(fn) || KNOWN_DEBT.has(fn)) {
    if (KNOWN_DEBT.has(fn)) debt.push(`${fn} (trigger su ${tbl}): ${KNOWN_DEBT.get(fn)}`);
    continue;
  }
  errors.push(`${fn} (trigger su ${tbl}): manca SET search_path`);
}
for (const line of definerRows.trim().split("\n").filter(Boolean)) {
  const fn = line.trim();
  if (!fn) continue;
  if (ALLOWLIST.has(fn) || KNOWN_DEBT.has(fn)) {
    if (KNOWN_DEBT.has(fn)) debt.push(`${fn} (SECURITY DEFINER): ${KNOWN_DEBT.get(fn)}`);
    continue;
  }
  errors.push(`${fn} (SECURITY DEFINER chiamabile): manca SET search_path`);
}

for (const d of debt) console.error(`DEBT: ${d}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`VIOLATION: ${e}`);
  console.error(
    `\ncheck-search-path: FALLITO (${errors.length} funzioni senza search_path pinnato, #102). ` +
      `Pinna con SET search_path = public[, extensions] nella migrazione.`
  );
  process.exit(1);
}
console.log(
  `check-search-path: OK (container ${CONTAINER}${debt.length ? `, ${debt.length} debito noto #102` : ""})`
);
