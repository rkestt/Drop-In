import { describe, expect, it } from "vitest";
import {
  nextFavoriteState,
  shouldRedirectToLogin,
  toFavoritesResult,
} from "@/lib/favorites/toggle";

describe("nextFavoriteState", () => {
  it("flips the current state", () => {
    expect(nextFavoriteState(false)).toBe(true);
    expect(nextFavoriteState(true)).toBe(false);
  });

  it("is an involution", () => {
    expect(nextFavoriteState(nextFavoriteState(true))).toBe(true);
    expect(nextFavoriteState(nextFavoriteState(false))).toBe(false);
  });
});

describe("shouldRedirectToLogin", () => {
  it("redirects anonymous viewers", () => {
    expect(shouldRedirectToLogin(null)).toBe(true);
    expect(shouldRedirectToLogin(undefined)).toBe(true);
  });

  it("lets signed-in viewers toggle", () => {
    expect(shouldRedirectToLogin("11111111-1111-1111-1111-111111111111")).toBe(
      false
    );
  });
});

describe("toFavoritesResult", () => {
  it("maps no error to ok", () => {
    expect(toFavoritesResult(null)).toEqual({ ok: true });
    expect(toFavoritesResult(undefined)).toEqual({ ok: true });
  });

  it("maps a Supabase error to ok:false with its message", () => {
    expect(toFavoritesResult({ message: "boom" })).toEqual({
      ok: false,
      message: "boom",
    });
  });

  it("falls back when the message is empty", () => {
    const result = toFavoritesResult({ message: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message.length).toBeGreaterThan(0);
  });
});
