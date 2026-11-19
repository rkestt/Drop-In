import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/auth/routes";
import {
  NEW_PASSWORD_MIN,
  newPasswordSchema,
} from "@/lib/validation/schemas";
import {
  NEW_PASSWORD_PATH,
  isRateLimitError,
  mapNewPasswordError,
  newPasswordResetRedirect,
} from "@/components/auth/new-password";
import { parseHashTokens } from "@/components/auth/hash-session";

describe("newPasswordSchema (ticket 109)", () => {
  it("accetta password di 8+ caratteri con conferma uguale", () => {
    const r = newPasswordSchema.safeParse({
      password: "campo-aperto-42",
      confirm: "campo-aperto-42",
    });
    expect(r.success).toBe(true);
  });

  it("rifiuta sotto gli 8 caratteri con messaggio italiano", () => {
    const r = newPasswordSchema.safeParse({
      password: "corta7!",
      confirm: "corta7!",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toMatch(/8/);
      expect(r.error.issues[0]?.path).toEqual(["password"]);
    }
  });

  it("rifiuta la conferma diversa sulla chiave confirm", () => {
    const r = newPasswordSchema.safeParse({
      password: "campo-aperto-42",
      confirm: "campo-aperto-43",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toMatch(/coincidono/);
      expect(r.error.issues[0]?.path).toEqual(["confirm"]);
    }
  });

  it("rifiuta i campi vuoti", () => {
    expect(
      newPasswordSchema.safeParse({ password: "", confirm: "" }).success
    ).toBe(false);
    const r = newPasswordSchema.safeParse({
      password: "campo-aperto-42",
      confirm: "",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.path).toEqual(["confirm"]);
    }
  });

  it("il minimo è exported e vale 8", () => {
    expect(NEW_PASSWORD_MIN).toBe(8);
  });
});

describe("mapNewPasswordError (ticket 109)", () => {
  it("sessione scaduta -> italiano, senza retry", () => {
    const info = mapNewPasswordError({
      code: "401",
      message: "session expired, token revoked",
    });
    expect(info.message).toMatch(/sessione/i);
    expect(info.canRetry).toBe(false);
    expect(info.message).not.toContain("session expired");
  });

  it("errore rete -> italiano con retry", () => {
    const info = mapNewPasswordError(new Error("failed to fetch"));
    expect(info.message).toMatch(/connessione/i);
    expect(info.canRetry).toBe(true);
  });

  it("password debole del server -> italiano, mai il raw", () => {
    const raw = "Password should be at least 6 characters";
    const info = mapNewPasswordError({ message: raw });
    expect(info.message).not.toContain(raw);
    expect(info.message).toMatch(/sicura|lunga/i);
  });

  it("errore generico con 'should be' ma senza 'password' -> generico, non debole", () => {
    const raw = "Email should be unique";
    const info = mapNewPasswordError({ message: raw });
    expect(info.message).not.toContain(raw);
    expect(info.message).toMatch(/aggiornare la password/i);
  });

  it("rate limit GoTrue -> messaggio dedicato con retry", () => {
    const raw =
      "For security purposes, you can only request this after 18 seconds";
    const info = mapNewPasswordError({ message: raw });
    expect(info.message).toMatch(/troppi tentativi/i);
    expect(info.message).not.toContain(raw);
    expect(info.canRetry).toBe(true);
    expect(isRateLimitError({ message: raw })).toBe(true);
    expect(isRateLimitError({ message: "boom" })).toBe(false);
    expect(isRateLimitError(null)).toBe(false);
  });

  it("sconosciuto -> generico fisso, mai il raw", () => {
    const raw = "database exploded (P0001)";
    const info = mapNewPasswordError({ message: raw });
    expect(info.message).not.toContain(raw);
    expect(info.message).toMatch(/password/i);
  });

  it("null/undefined -> generico senza esplodere", () => {
    expect(mapNewPasswordError(null).message).toMatch(/password/i);
    expect(mapNewPasswordError(undefined).canRetry).toBe(true);
  });
});

describe("newPasswordResetRedirect (ticket 109)", () => {
  it("punta al callback con next=/auth/nuova-password", () => {
    const url = newPasswordResetRedirect("http://localhost:3000");
    expect(url).toBe(
      "http://localhost:3000/api/auth/callback?next=%2Fauth%2Fnuova-password"
    );
  });

  it("il next sopravvive a safeNext (niente open redirect)", () => {
    const url = new URL(newPasswordResetRedirect("http://localhost:3000"));
    expect(safeNext(url.searchParams.get("next"))).toBe(NEW_PASSWORD_PATH);
  });
});

describe("parseHashTokens (ticket 109)", () => {
  const hash =
    "#access_token=aaa.bbb.ccc&expires_at=1&refresh_token=rrr&type=invite";

  it("estrae access e refresh token dal fragment", () => {
    expect(parseHashTokens(hash)).toEqual({
      accessToken: "aaa.bbb.ccc",
      refreshToken: "rrr",
    });
  });

  it("accetta il fragment senza # iniziale", () => {
    expect(parseHashTokens(hash.slice(1))?.accessToken).toBe("aaa.bbb.ccc");
  });

  it("null quando manca un token o il fragment è vuoto", () => {
    expect(parseHashTokens(null)).toBeNull();
    expect(parseHashTokens("")).toBeNull();
    expect(parseHashTokens("#")).toBeNull();
    expect(parseHashTokens("#access_token=solo")).toBeNull();
    expect(parseHashTokens("#type=invite")).toBeNull();
  });
});
