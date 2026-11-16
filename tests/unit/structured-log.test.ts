import { describe, expect, it } from "vitest";
import {
  formatEvent,
  redactFields,
  type StructuredEvent,
} from "@/lib/observability/structured";

describe("structured logging (#32/#88)", () => {
  it("una riga JSON con ts, level, event e campi", () => {
    const line = formatEvent({
      level: "info",
      event: "server.boot",
      fields: { version: "0.1.0", env: "preview" },
      now: new Date("2026-11-16T10:00:00.000Z"),
    });
    expect(line).not.toContain("\n");
    expect(JSON.parse(line)).toEqual({
      ts: "2026-11-16T10:00:00.000Z",
      level: "info",
      event: "server.boot",
      version: "0.1.0",
      env: "preview",
    });
  });

  it("redige le chiavi sensibili anche annidate", () => {
    const out = redactFields({
      user: "andrea@example.com",
      supabaseKey: "sb_secret_xxx",
      nested: { authorization: "Bearer abc", ok: 1 },
      SMTP_PASSWORD: "hunter2",
      dsn: "postgres://user:pass@host/db",
    });
    expect(out.user).toBe("andrea@example.com");
    expect(out.supabaseKey).toBe("[redacted]");
    expect(out.nested).toEqual({ authorization: "[redacted]", ok: 1 });
    expect(out.SMTP_PASSWORD).toBe("[redacted]");
    expect(out.dsn).toBe("[redacted]");
  });

  it("taglia i valori lunghi invece di stamparli interi", () => {
    const out = redactFields({ body: "x".repeat(500) });
    expect(String(out.body)).toHaveLength(201);
    expect(String(out.body).endsWith("…")).toBe(true);
  });

  it("non muta l'oggetto di input", () => {
    const input = { token: "abc", keep: "yes" };
    redactFields(input);
    expect(input.token).toBe("abc");
  });

  it("un evento senza campi resta valido", () => {
    const event: StructuredEvent = { level: "warn", event: "health.degraded" };
    expect(JSON.parse(formatEvent(event))).toMatchObject({
      level: "warn",
      event: "health.degraded",
    });
  });
});
