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

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
