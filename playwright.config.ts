import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// Parse .env.local manually (no dotenv dependency needed)
function loadEnvLocal(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const raw = fs.readFileSync(path.resolve(__dirname, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2];
    }
  } catch {
    // fall back to shell env
  }
  return env;
}

// envLocal kept for Supabase URL injection if needed (currently env injected via .env.local auto-load by Next)
const envLocal = loadEnvLocal();

// Chiave service-role SOLO per il Supabase locale: la route
// POST /api/account/delete la legge dal dev server e .env.local non ce
// l'ha, quindi su clone pulito il gate era rosso. La si inietta qui (il dev
// server la eredita da `webServer.env`) solo quando l'app punta davvero al
// locale: URL assente (= default del dev, proxy `/supabase` di next.config.js
// verso 127.0.0.1:54321), oppure 127.0.0.1/localhost, oppure path relativo
// del proxy. MAI se punta a `https://*.supabase.co` (staging/prod).
// Perche' e' sicura: e' il JWT deterministico del secret di default dello
// stack locale (stesso valore gia' committato in tests/e2e/helpers/auth.ts),
// vale solo contro quel DB; senza prefisso NEXT_PUBLIC_ non finisce nel
// build client, resta server-only del dev server dei test.
const E2E_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? envLocal.NEXT_PUBLIC_SUPABASE_URL ?? "";
function isLocalSupabaseTarget(raw: string): boolean {
  if (raw === "") return true;
  if (/\.supabase\.co(\/|$)/.test(raw)) return false;
  return raw.startsWith("/") || /127\.0\.0\.1|localhost/.test(raw);
}
const LOCAL_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// Porta parametrica: default 3100. Lane parallele o run manuali mentre la
// 3100 è occupata usano E2E_PORT=3140 (il webServer riusato segue la porta).
const E2E_PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./tests/e2e",
  // #110: outputDir univoco per processo. Ogni processo Playwright
  // ripulisce l'intero outputDir all'avvio: con la directory condivisa
  // due run (anche di sessioni diverse) si cancellavano a vicenda gli
  // artifact a meta' run -> teardown ENOENT su .playwright-artifacts-*/
  // traces/*.network e *.zip. `outputDir` per worker (TEST_PARALLEL_INDEX)
  // NON bastava perche' la pulizia e' a livello di intera directory.
  // Reporter `list` indifferente al path; trace: `npx playwright
  // show-trace test-results/run-<pid>/<spec>-.../trace.zip`.
  outputDir: `test-results/run-${process.pid}`,
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  // Due worker, non il default (meta' dei core): con sei browser insieme il
  // server non stava dietro e tre test diversi sono caduti per fatica, non
  // per difetti. Le riprove automatiche restano a zero: un cancello ogni
  // tanto rosso per caso insegna a ignorare il rosso.
  workers: 2,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: "retain-on-failure",
    // Utente "di ritorno": onboarding e coach già visti, altrimenti il drawer
    // del primo avvio rende inert il contenuto e gli e2e non trovano le sezioni.
    storageState: "tests/e2e/storage-state.json",
  },
  projects: [
    {
      // E2E normali: fuori i visual, che hanno progetti propri (suffisso
      // di snapshot diverso e, per `visual-full`, il database).
      name: "e2e",
      testIgnore: ["**/screens-visual.spec.ts", "**/screens-visual-full.spec.ts", "**/styleguide-visual.spec.ts"],
    },
    {
      // Senza Supabase: gira anche in CI (vedi job visual-static).
      name: "visual-static",
      testMatch: ["**/screens-visual.spec.ts", "**/styleguide-visual.spec.ts"],
      use: {
        timezoneId: "Europe/Rome",
        locale: "it-IT",
      },
    },
    {
      // Motore Safari con profilo iPhone: la verifica che Chromium non può fare
      // (dvh, inert, touch). `npm run test:ios`. Non entra in `test:all`: in CI
      // la esegue il job quality dopo `playwright install --with-deps webkit`.
      name: "iphone-webkit",
      testMatch: ["**/ios.spec.ts"],
      use: { ...devices["iPhone 13"] },
    },
    {
      // Con Supabase locale: solo in locale con E2E_WITH_DB=1
      // (fuori CI: `npm run test:visual:full`). Senza la env, i test
      // si skippano da soli ed il progetto resta verde.
      name: "visual-full",
      testMatch: ["**/screens-visual-full.spec.ts"],
      use: {
        timezoneId: "Europe/Rome",
        locale: "it-IT",
      },
    },
  ],
  webServer: {
    // `next dev`, non build di produzione: `/styleguide` chiama `notFound()`
    // in produzione (`app/styleguide/page.tsx:11`) e i demo di drawer, toast
    // e motion girano solo li'. Il prezzo del dev server e' la compilazione
    // alla prima visita, e si paga con `workers: 2` piu' sotto: a 6 worker
    // tre test cadevano per contesa, non per difetti.
    command: `npm run dev -- -p ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
    // Il server gira in UTC come su Vercel/CI: gli orari mostrati sono
    // sempre quelli di Roma (lib/datetime.ts, APP_TIME_ZONE). Cosi' un
    // `toLocale*` senza timeZone (#78) fa fallire l'e2e invece di passare
    // perche' la macchina di turno e' gia' a Roma.
    // MA: reuseExistingServer=true riusa un dev server già avviato a mano
    // CON LA SUA TZ — se quello gira a Europe/Rome la garanzia UTC salta.
    // Prima degli e2e sensibili al fuso (hydration.spec.ts) killare gli
    // altri dev server: `lsof -ti:3100 | xargs kill` (o E2E_PORT).
    // La service-role locale serve alle route account anche in dev
    // (vedi sopra): senza, POST /api/account/delete risponde 500
    // "service role non configurato". Solo contro il locale, mai remoto.
    env: {
      TZ: "UTC",
      ...(isLocalSupabaseTarget(E2E_SUPABASE_URL)
        ? { SUPABASE_SERVICE_ROLE_KEY: LOCAL_SERVICE_ROLE_KEY }
        : {}),
    },
  },
});
