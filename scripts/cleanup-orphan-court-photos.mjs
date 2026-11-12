#!/usr/bin/env node
/**
 * Garbage collection degli oggetti orfani nel bucket `court-photos`.
 *
 * Gli orfani nascono così: upload riuscito + `submit_court` fallita, oppure
 * court cancellata (FK a NULL). Le submission scartate (duplicata/rifiutata)
 * NON creano orfani: `reject_court`/`mark_duplicate` aggiornano solo
 * `moderation_status`, la riga resta e resta referenziata — quelle foto sono
 * ritenzione intenzionale, non orfani. Niente li pulisce da solo e sullo staging c'è traffico reale,
 * quindi il bucket cresce senza mai sfoltirsi (piano free: 1 GB storage).
 *
 *   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/cleanup-orphan-court-photos.mjs [--apply] [--min-age-hours=24]
 *
 * - Default **dry-run**: elenca e basta. Solo `--apply` cancella davvero.
 * - Finestra di sicurezza `--min-age-hours` (default 24): gli oggetti più
 *   giovani non si toccano mai (upload in corso mentre la submission è
 *   ancora aperta nel browser).
 * - API usate, entrambe con la service role key:
 *   storage `POST /storage/v1/object/list/court-photos` (walk ricorsivo per
 *   prefisso: i path sono `<uid>/<uuid>.<ext>`, un livello solo, ma la
 *   ricorsione regge anche sottocartelle future) e cancellazione
 *   `DELETE /storage/v1/object/court-photos` con `{ prefixes: [...] }`
 *   (stesso endpoint di `supabase-js` `remove()`); PostgREST
 *   `GET /rest/v1/courts?select=photo_path` paginato per i riferimenti.
 * - Mai contro il locale: in locale non c'è traffico reale, gli "orfani"
 *   sono quasi sempre upload di una sessione di dev ancora aperta.
 * - Exit code: 0 ok, 1 almeno una cancellazione fallita, 2 errore di
 *   configurazione/rete/flag.
 *
 * Zero dipendenze: solo fetch globale.
 */
const BUCKET = "court-photos";
const LIST_PAGE = 1000;
const REFS_PAGE = 1000;
const DELETE_BATCH = 100;
const MAX_PRINT = 50;

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
async function listPrefix(base, headers, prefix, out) {
  let offset = 0;
  for (;;) {
    const res = await fetch(`${base}/storage/v1/object/list/${BUCKET}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        prefix,
        limit: LIST_PAGE,
        offset,
        sortBy: { column: "name", order: "asc" },
      }),
    });
    const entries = await readJson(res, `list storage (prefix "${prefix}")`);
    if (!Array.isArray(entries)) fail(`list storage: risposta inattesa per prefix "${prefix}".`);
    for (const e of entries) {
      if (e.id == null) {
        const sub = prefix ? `${prefix}/${e.name}` : e.name;
        await listPrefix(base, headers, sub, out);
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

async function fetchReferenced(base, headers) {
  const refs = new Set();
  let offset = 0;
  for (;;) {
    const url =
      `${base}/rest/v1/courts?select=photo_path&photo_path=not.is.null` +
      `&order=id&limit=${REFS_PAGE}&offset=${offset}`;
    const res = await fetch(url, { headers });
    const rows = await readJson(res, "lettura courts.photo_path");
    if (!Array.isArray(rows)) fail("lettura courts.photo_path: risposta inattesa.");
    for (const r of rows) if (r.photo_path) refs.add(r.photo_path);
    if (rows.length < REFS_PAGE) break;
    offset += REFS_PAGE;
  }
  return refs;
}

async function deleteBatch(base, headers, paths) {
  const res = await fetch(`${base}/storage/v1/object/${BUCKET}`, {
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

const objects = [];
await listPrefix(url, headers, "", objects);
const referenced = await fetchReferenced(url, headers);

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

log(`oggetti: ${objects.length} · referenziati: ${referenced.size} · orfani: ${orphans.length}`);
log(
  `orfani cancellabili (età ≥ ${minAgeHours}h): ${eligible.length}` +
    ` · troppo recenti: ${tooYoung.length} · senza data (mai toccati): ${undated.length}`,
);
for (const o of orphans.slice(0, MAX_PRINT)) log(`  · ${o.path}`);
if (orphans.length > MAX_PRINT) log(`  … +${orphans.length - MAX_PRINT} altri`);

if (!apply) {
  log(`dry-run: nessuna cancellazione (riavvia con --apply per cancellare i ${eligible.length} idonei).`);
  process.exit(0);
}

let deleted = 0;
const failed = [];
for (let i = 0; i < eligible.length; i += DELETE_BATCH) {
  const batch = eligible.slice(i, i + DELETE_BATCH).map((o) => o.path);
  try {
    await deleteBatch(url, headers, batch);
    deleted += batch.length;
    log(`cancellati ${deleted}/${eligible.length}…`);
  } catch (err) {
    failed.push(...batch);
    console.error(`[photos-gc] ✖ batch ${i / DELETE_BATCH + 1}: ${err.message}`);
  }
}

log(`cancellati: ${deleted} · falliti: ${failed.length}`);
for (const p of failed.slice(0, MAX_PRINT)) console.error(`[photos-gc] ✖ ${p}`);
if (failed.length > 0) process.exit(1);
