#!/usr/bin/env node
/**
 * Smoke test di un ambiente già deployato (stage o prod), senza browser.
 *
 *   node scripts/smoke.mjs https://drop-in-stage.vercel.app
 *   node scripts/smoke.mjs https://drop-in-stage.vercel.app --with-health
 *
 * Controlla:
 *  1. `/` risponde 200 e contiene il titolo dell'app.
 *  2. `/manifest.json` risponde 200 ed è JSON valido con `name`.
 *  3. (opzionale) `/api/health` risponde 200 e `{ status: "ok" }`.
 *
 * Esce 1 al primo fallimento: in CI il job diventa rosso e si sa quale
 * ambiente è rotto. Nessuna dipendenza: solo `fetch` (Node 22).
 */

const args = process.argv.slice(2);
const base = args.find((a) => !a.startsWith("-"));
const withHealth = args.includes("--with-health");

if (!base) {
  console.error("Uso: node scripts/smoke.mjs <base-url> [--with-health]");
  process.exit(2);
}

const baseUrl = base.replace(/\/+$/, "");

async function get(path) {
  const url = `${baseUrl}${path}`;
  const started = Date.now();
  const res = await fetch(url, { redirect: "follow" });
  const body = await res.text();
  return { url, status: res.status, body, ms: Date.now() - started };
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

async function main() {
  const home = await get("/");
  if (home.status !== 200) fail(`/ -> HTTP ${home.status}`);
  if (!/Drop-In/i.test(home.body)) fail("/ non contiene 'Drop-In'");
  console.log(`✓ / 200 (${home.ms} ms)`);

  const manifest = await get("/manifest.json");
  if (manifest.status !== 200) fail(`/manifest.json -> HTTP ${manifest.status}`);
  let parsed;
  try {
    parsed = JSON.parse(manifest.body);
  } catch {
    fail("/manifest.json non è JSON");
  }
  if (!parsed.name) fail("/manifest.json senza 'name'");
  console.log(`✓ /manifest.json 200 (${manifest.ms} ms)`);

  if (withHealth) {
    const health = await get("/api/health");
    if (health.status !== 200) fail(`/api/health -> HTTP ${health.status}`);
    let payload;
    try {
      payload = JSON.parse(health.body);
    } catch {
      fail("/api/health non è JSON");
    }
    if (payload.status !== "ok") fail(`/api/health status=${payload.status}`);
    console.log(`✓ /api/health ok (${health.ms} ms)`);
  } else {
    const health = await get("/api/health");
    if (health.status === 200) console.log("✓ /api/health 200 (extra)");
    else console.log(`· /api/health HTTP ${health.status} (non richiesto)`);
  }

  console.log(`Smoke OK su ${baseUrl}`);
}

main().catch((err) => {
  console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
