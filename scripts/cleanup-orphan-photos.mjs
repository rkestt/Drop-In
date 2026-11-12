#!/usr/bin/env node
/**
 * Garbage collection degli oggetti orfani nei bucket `court-photos` e `avatars`.
 *
 * Gli orfani nascono così: upload riuscito + `submit_court` fallita (foto campi),
 * avatar sostituito o rimosso senza cancellare il vecchio oggetto, oppure riga
 * cancellata (FK a NULL). Le submission scartate (duplicata/rifiutata) NON creano
 * orfani: `reject_court`/`mark_duplicate` aggiornano solo `moderation_status`,
 * la riga resta e resta referenziata — quelle foto sono ritenzione intenzionale,
 * non orfani. Niente li pulisce da solo e sullo staging c'è traffico reale,
 * quindi i bucket crescono senza mai sfoltirsi (piano free: 1 GB storage).
 *
 * Referenze tracciate:
 *   court-photos -> courts.photo_path (bare path `<uid>/<uuid>.<ext>`)
 *   avatars      -> profiles.avatar_url (URL pubblico assoluto oppure bare
 *                   path: conta la parte dopo
 *                   `/storage/v1/object/public/avatars/`)
 *
 *   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/cleanup-orphan-photos.mjs [--apply] [--min-age-hours=24]
 *
 * - Default **dry-run**: elenca e basta. Solo `--apply` cancella davvero.
 * - Finestra di sicurezza `--min-age-hours` (default 24): gli oggetti più
 *   giovani non si toccano mai (upload in corso mentre la submission è
 *   ancora aperta nel browser, o avatar appena caricato prima del write su
 *   `profiles`).
 * - API usate, entrambe con la service role key:
 *   storage `POST /storage/v1/object/list/<bucket>` (walk ricorsivo per
 *   prefisso: i path sono `<uid>/<uuid>.<ext>`, un livello solo, ma la
 *   ricorsione regge anche sottocartelle future) e cancellazione
 *   `DELETE /storage/v1/object/<bucket>` con `{ prefixes: [...] }`
 *   (stesso endpoint di `supabase-js` `remove()`); PostgREST
 *   `GET /rest/v1/<table>?select=<col>` paginato per i riferimenti.
 * - Mai contro il locale: in locale non c'è traffico reale, gli "orfani"
 *   sono quasi sempre upload di una sessione di dev ancora aperta.
 * - Exit code: 0 ok, 1 almeno una cancellazione fallita, 2 errore di
 *   configurazione/rete/flag.
 *
 * Perché non è un pg_cron job (vedi issue #52): pg_cron gira dentro Postgres
 * e non può chiamare la Storage API (serve la service role key su HTTP).
 * Cadenza: manuale `--apply` mensile finché non c'è traffico reale, poi uno
 * scheduler esterno (GitHub Action o Vercel Cron) con gli stessi secret.
 *
 * Zero dipendenze: solo fetch globale.
 */
const LIST_PAGE = 1000;
const REFS_PAGE = 1000;
const DELETE_BATCH = 100;
const MAX_PRINT = 50;

const AVATARS_PUBLIC_MARKER = "/storage/v1/object/public/avatars/";

/** Path oggetto da un `profiles.avatar_url` (URL assoluto o bare path). */
function avatarRefToPath(value) {
  if (!value) return null;
  if (value.includes("://")) {
    const i = value.indexOf(AVATARS_PUBLIC_MARKER);
    if (i === -1) return null;
    return value.slice(i + AVATARS_PUBLIC_MARKER.length) || null;
  }
  const path = value.replace(/^\/+/, "");
  return path || null;
}

const BUCKETS = [
  {
    bucket: "court-photos",
    table: "courts",
    column: "photo_path",
    toPath: (v) => (v ? v : null),
  },
  {
    bucket: "avatars",
    table: "profiles",
    column: "avatar_url",
    toPath: avatarRefToPath,
  },
];

function log(msg) {
  console.log(`[photos-gc] ${msg}`);
}

function fail(msg, code = 2) {
  console.error(`[photos-gc] ✖ ${msg}`);
  process.exit(code);
}

function parseArgs(argv) {
  let apply = false;
  let minAgeHours = 24;
  for (const arg of argv) {
    if (arg === "--apply") {
      apply = true;
    } else if (arg.startsWith("--min-age-hours=")) {
      const raw = arg.slice("--min-age-hours=".length);
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) fail(`--min-age-hours non valido: "${raw}".`);
      minAgeHours = n;
    } else {
      fail(`flag sconosciuto: "${arg}" (ammessi: --apply, --min-age-hours=N).`);
    }
  }
  return { apply, minAgeHours };
}

async function readJson(res, cosa) {
  const text = await res.text();
  if (!res.ok) fail(`${cosa}: HTTP ${res.status}: ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch {
    fail(`${cosa}: risposta non JSON: ${text.slice(0, 200)}`);
  }
}

// Walk ricorsivo: le cartelle arrivano con `id` null, i file con `id` e timestamp.
async function listPrefix(base, headers, bucket, prefix, out) {
  let offset = 0;
  for (;;) {
    const res = await fetch(`${base}/storage/v1/object/list/${bucket}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        prefix,
        limit: LIST_PAGE,
        offset,
        sortBy: { column: "name", order: "asc" },
      }),
    });
    const entries = await readJson(res, `list storage "${bucket}" (prefix "${prefix}")`);
    if (!Array.isArray(entries)) fail(`list storage "${bucket}": risposta inattesa per prefix "${prefix}".`);
    for (const e of entries) {
      if (e.id == null) {
        const sub = prefix ? `${prefix}/${e.name}` : e.name;
        await listPrefix(base, headers, bucket, sub, out);
      } else {
        out.push({
          path: prefix ? `${prefix}/${e.name}` : e.name,
          createdAt: e.created_at ?? e.updated_at ?? null,
        });
      }
    }
    if (entries.length < LIST_PAGE) break;
    offset += LIST_PAGE;
  }
}

async function fetchReferenced(base, headers, { table, column, toPath }) {
  const refs = new Set();
  let offset = 0;
  for (;;) {
    const url =
      `${base}/rest/v1/${table}?select=${column}&${column}=not.is.null` +
      `&order=id&limit=${REFS_PAGE}&offset=${offset}`;
    const res = await fetch(url, { headers });
    const rows = await readJson(res, `lettura ${table}.${column}`);
    if (!Array.isArray(rows)) fail(`lettura ${table}.${column}: risposta inattesa.`);
    for (const r of rows) {
      const p = toPath(r[column]);
      if (p) refs.add(p);
    }
    if (rows.length < REFS_PAGE) break;
    offset += REFS_PAGE;
  }
  return refs;
}

async function deleteBatch(base, headers, bucket, paths) {
  const res = await fetch(`${base}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: paths }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
}

const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url) fail("SUPABASE_URL mancante (es. https://<ref>.supabase.co).");
if (!serviceKey) fail("SUPABASE_SERVICE_ROLE_KEY mancante (service role, mai committarla).");

const { apply, minAgeHours } = parseArgs(process.argv.slice(2));
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
const cutoff = Date.now() - minAgeHours * 3_600_000;

let totalEligible = 0;
const allFailed = [];

for (const cfg of BUCKETS) {
  const objects = [];
  await listPrefix(url, headers, cfg.bucket, "", objects);
  const referenced = await fetchReferenced(url, headers, cfg);
  const orphans = objects.filter((o) => !referenced.has(o.path));

  const eligible = [];
  const tooYoung = [];
  const undated = [];
  for (const o of orphans) {
    const t = o.createdAt ? Date.parse(o.createdAt) : NaN;
    if (!Number.isFinite(t)) undated.push(o);
    else if (t > cutoff) tooYoung.push(o);
    else eligible.push(o);
  }

  log(`[${cfg.bucket}] oggetti: ${objects.length} · referenziati: ${referenced.size} · orfani: ${orphans.length}`);
  log(
    `[${cfg.bucket}] orfani cancellabili (età ≥ ${minAgeHours}h): ${eligible.length}` +
      ` · troppo recenti: ${tooYoung.length} · senza data (mai toccati): ${undated.length}`,
  );
  for (const o of orphans.slice(0, MAX_PRINT)) log(`  · ${o.path}`);
  if (orphans.length > MAX_PRINT) log(`  … +${orphans.length - MAX_PRINT} altri`);

  if (apply) {
    let deleted = 0;
    for (let i = 0; i < eligible.length; i += DELETE_BATCH) {
      const batch = eligible.slice(i, i + DELETE_BATCH).map((o) => o.path);
      try {
        await deleteBatch(url, headers, cfg.bucket, batch);
        deleted += batch.length;
        log(`[${cfg.bucket}] cancellati ${deleted}/${eligible.length}…`);
      } catch (err) {
        allFailed.push(...batch);
        console.error(`[photos-gc] ✖ [${cfg.bucket}] batch ${i / DELETE_BATCH + 1}: ${err.message}`);
      }
    }
    log(`[${cfg.bucket}] cancellati: ${deleted} · falliti: ${allFailed.length}`);
  }

  totalEligible += eligible.length;
}

if (!apply) {
  log(`dry-run: nessuna cancellazione (riavvia con --apply per cancellare i ${totalEligible} idonei).`);
  process.exit(0);
}

for (const p of allFailed.slice(0, MAX_PRINT)) console.error(`[photos-gc] ✖ ${p}`);
if (allFailed.length > 0) process.exit(1);
