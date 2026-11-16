import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildHealthReport,
  checkDatabase,
  type HealthCheck,
} from "@/lib/observability/health";

const okCheck: HealthCheck = {
  name: "database",
  status: "ok",
  latency_ms: 12,
};

const boot = new Date("2026-11-16T10:00:00.000Z").getTime();

describe("buildHealthReport (#88)", () => {
  it("ok quando ogni check è ok, con version/commit/env/uptime", () => {
    const report = buildHealthReport({
      version: "0.1.0",
      commit: "abc123",
      env: "preview",
      now: new Date(boot + 90_000),
      bootedAt: boot,
      checks: [okCheck],
    });
    expect(report).toMatchObject({
      status: "ok",
      version: "0.1.0",
      commit: "abc123",
      env: "preview",
      uptime_s: 90,
    });
    expect(report.timestamp).toBe("2026-11-16T10:01:30.000Z");
  });

  it("degraded se un check è degraded (il payload resta completo)", () => {
    const report = buildHealthReport({
      version: "0.1.0",
      now: new Date(boot),
      bootedAt: boot,
      checks: [
        okCheck,
        {
          name: "database",
          status: "degraded",
          latency_ms: null,
          detail: "timeout",
        },
      ],
    });
    expect(report.status).toBe("degraded");
    expect(report.checks).toHaveLength(2);
    expect(report.env).toBe("unknown");
    expect(report.commit).toBeNull();
  });
});

describe("checkDatabase (#88)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("200 -> ok con latenza", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("[]", { status: 200 }))
    );
    const check = await checkDatabase("https://example.supabase.co/", "anon");
    expect(check.status).toBe("ok");
    expect(check.name).toBe("database");
    expect(check.latency_ms).toBeGreaterThanOrEqual(0);
  });

  it("500 -> degraded con HTTP nel detail, senza corpo o chiave", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"message":"boom"}', { status: 500 }))
    );
    const check = await checkDatabase("https://example.supabase.co", "anon");
    expect(check.status).toBe("degraded");
    expect(check.detail).toBe("HTTP 500");
  });

  it("rete che esplode -> degraded, detail stabile", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("getaddrinfo EAI_AGAIN very-secret-host");
      })
    );
    const check = await checkDatabase("https://example.supabase.co", "anon");
    expect(check.status).toBe("degraded");
    expect(check.detail).toBe("rete non raggiungibile");
    expect(check.detail).not.toContain("very-secret-host");
  });

  it("timeout -> degraded con timeout nel detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              const err = new Error("aborted");
              err.name = "AbortError";
              reject(err);
            });
          })
      )
    );
    const check = await checkDatabase("https://example.supabase.co", "anon", 10);
    expect(check.status).toBe("degraded");
    expect(check.detail).toBe("timeout dopo 10ms");
  });

  it("usa la anon key come header apikey e non la mette nell'URL", async () => {
    const spy = vi.fn(async () => new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", spy);
    await checkDatabase("https://example.supabase.co", "anon-key-123");
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://example.supabase.co/rest/v1/courts?select=id&limit=1"
    );
    expect(url).not.toContain("anon-key-123");
    expect((init.headers as Record<string, string>).apikey).toBe(
      "anon-key-123"
    );
  });
});
