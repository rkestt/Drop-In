import { describe, expect, it } from "vitest";
import { postgrestErrorFields } from "@/lib/errors/postgrest";

// Helper #103: con `shouldThrowOnError: false` PostgREST restituisce un
// oggetto semplice, non un'istanza di Error — i check `instanceof Error`
// scartavano sempre codice e messaggio.
describe("postgrestErrorFields", () => {
  it("oggetto semplice PostgREST → code e message", () => {
    const out = postgrestErrorFields({
      code: "P0001",
      message: "Lobby al completo (posti esauriti)",
      details: null,
      hint: null,
    });
    expect(out).toEqual({
      code: "P0001",
      message: "Lobby al completo (posti esauriti)",
    });
  });

  it("Error con .code extra → code e message", () => {
    const err = new Error("duplicate key value") as Error & { code: string };
    err.code = "23505";
    expect(postgrestErrorFields(err)).toEqual({
      code: "23505",
      message: "duplicate key value",
    });
  });

  it("Error senza code → code null", () => {
    expect(postgrestErrorFields(new Error("boom"))).toEqual({
      code: null,
      message: "boom",
    });
  });

  it("null → campi vuoti, non crash", () => {
    expect(postgrestErrorFields(null)).toEqual({ code: null, message: "" });
    expect(postgrestErrorFields(undefined)).toEqual({
      code: null,
      message: "",
    });
  });

  it("stringa → message intatto, code null", () => {
    expect(postgrestErrorFields("Failed to fetch")).toEqual({
      code: null,
      message: "Failed to fetch",
    });
  });

  it("code non stringa → null, message non stringa → vuoto", () => {
    expect(postgrestErrorFields({ code: 400, message: 42 })).toEqual({
      code: null,
      message: "",
    });
  });
});
