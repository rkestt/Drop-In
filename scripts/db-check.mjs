#!/usr/bin/env node
/**
 * Confronta le migration locali (`supabase/migrations/*.sql`) con quelle
 * applicate sul progetto remoto.
 *
 * Serve perché sul piano Supabase free **non esistono i database branch**:
 * il remoto è uno solo e fa da produzione. Il "branching" lo facciamo con git
 * + database locale; questo script è il controllo che il remoto non sia
 * rimasto indietro (o avanti) rispetto al branch che stiamo per deployare.
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_... npm run db:check
 *
 * - project ref: `SUPABASE_PROJECT_REF` oppure `supabase/.temp/project-ref`
 *   (creato da `npx supabase link`)
 * - token: un Personal Access Token con scope sul progetto (Management API)
 * - exit code: 0 allineato, 1 drift, 2 errore di configurazione/rete
 *
 * Non scrive nulla: usa l'endpoint di sola lettura `database/query`.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
const REF_FILE = path.join(ROOT, "supabase", ".temp", "project-ref");

function fail(msg, code = 2) {
  console.error(`✖ ${msg}`);
  process.exit(code);
}

function readRef() {
  const fromEnv = process.env.SUPABASE_PROJECT_REF?.trim();
  if (fromEnv) return fromEnv;
  try {
    return fs.readFileSync(REF_FILE, "utf8").trim();
  } catch {
    fail(
      "Project ref mancante: esporta SUPABASE_PROJECT_REF o esegui `npx supabase link --project-ref <ref>`.",
    );
  }
}

function localMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) fail("cartella supabase/migrations assente");
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => ({ version: f.slice(0, f.indexOf("_")), file: f }))
    .sort((a, b) => a.version.localeCompare(b.version));
}

async function remoteMigrations(ref, token) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query:
          "select version, name from supabase_migrations.schema_migrations order by version",
      }),
    },
  );

  const text = await res.text();
  if (!res.ok) {
    // Un progetto mai inizializzato non ha la tabella: è "zero migration".
    if (text.includes("42P01")) return [];
    fail(`Management API ${res.status}: ${text.slice(0, 300)}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    fail(`risposta non JSON: ${text.slice(0, 200)}`);
  }
  if (!Array.isArray(parsed)) fail(`risposta inattesa: ${text.slice(0, 200)}`);
  return parsed;
}

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
if (!token) {
  fail(
    "SUPABASE_ACCESS_TOKEN mancante (Personal Access Token da https://supabase.com/dashboard/account/tokens).",
  );
}

const ref = readRef();
const local = localMigrations();
const remote = await remoteMigrations(ref, token);

const remoteByVersion = new Map(remote.map((r) => [String(r.version), r.name]));
const localByVersion = new Map(local.map((l) => [l.version, l.file]));

const missing = local.filter((l) => !remoteByVersion.has(l.version));
const extra = remote.filter((r) => !localByVersion.has(String(r.version)));

console.log(`Progetto: ${ref}`);
console.log(`Locali: ${local.length} · remote: ${remote.length}`);

if (missing.length === 0 && extra.length === 0) {
  console.log("✔ Schema allineato (stesse versioni su locale e remoto).");
  process.exit(0);
}

if (missing.length > 0) {
  console.error(`\n✖ Da applicare sul remoto (${missing.length}):`);
  for (const m of missing) console.error(`  · ${m.file}`);
}

if (extra.length > 0) {
  console.error(`\n✖ Applicate sul remoto ma non presenti nel branch (${extra.length}):`);
  for (const r of extra) console.error(`  · ${r.version} ${r.name ?? ""}`);
}

console.error(
  "\nPrima di applicare: `npx supabase db push --linked --dry-run` e un dump (vedi docs/database-workflow.md).",
);
process.exit(1);
