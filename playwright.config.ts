import { defineConfig } from "@playwright/test";
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

// envLocal kept for future Supabase URL injection if needed (currently env injected via .env.local auto-load by Next)
const envLocal = loadEnvLocal();
void envLocal;

// Porta parametrica: default 3100. Lane parallele o run manuali mentre la
// 3100 è occupata usano E2E_PORT=3140 (il webServer riusato segue la porta).
const E2E_PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
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
    env: { TZ: "UTC" },
  },
});
