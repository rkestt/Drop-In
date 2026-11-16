import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/app-info";
import { buildHealthReport, checkDatabase } from "@/lib/observability/health";
import { logEvent } from "@/lib/observability/structured";

// Health per uptime monitor (#88). Deve essere sempre dinamico: nessuna
// cache, un 503 cached farebbe credere all'esterno che l'app sia giu'.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Timestamp del boot del processo: `uptime_s` nel payload.
const bootedAt = Date.now();

export async function GET(request: Request) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  // In locale `NEXT_PUBLIC_SUPABASE_URL` è il path relativo `/supabase` (proxy
  // del dev server): il fetch server-side vuole un URL assoluto, quindi si
  // risolve contro l'origine della richiesta. Su Vercel è già assoluto.
  const resolvedBaseUrl = baseUrl.startsWith("/")
    ? new URL(baseUrl, request.url).toString()
    : baseUrl;

  const check = resolvedBaseUrl && anonKey
    ? await checkDatabase(resolvedBaseUrl, anonKey)
    : {
        name: "database" as const,
        status: "degraded" as const,
        latency_ms: null,
        detail: "NEXT_PUBLIC_SUPABASE_URL/ANON_KEY non configurate",
      };

  const report = buildHealthReport({
    version: APP_VERSION,
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
    bootedAt,
    checks: [check],
  });

  if (report.status !== "ok") {
    logEvent({
      level: "warn",
      event: "health.degraded",
      fields: {
        check: check.name,
        detail: check.detail,
        latency_ms: check.latency_ms,
      },
    });
  }

  return NextResponse.json(report, {
    status: report.status === "ok" ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
