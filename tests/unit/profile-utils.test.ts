import { describe, expect, it } from "vitest";
import { getInitials, isBanActive } from "@/lib/profile/utils";

describe("getInitials", () => {
  it("nome singolo: prime due lettere", () => {
    expect(getInitials("LucaB")).toBe("LU");
  });

  it("nome e cognome: iniziali", () => {
    expect(getInitials("Luca Bianchi")).toBe("LB");
  });

  it("tollera spazi extra e nomi composti", () => {
    expect(getInitials("  luca   de  rossi ")).toBe("LR");
  });

  it("stringa vuota o spazi: nessuna iniziale", () => {
    expect(getInitials("")).toBe("");
    expect(getInitials("   ")).toBe("");
  });
});

describe("isBanActive", () => {
  const NOW = new Date("2026-11-10T12:00:00Z").getTime();

  it("null: non bannato", () => {
    expect(isBanActive(null, NOW)).toBe(false);
  });

  it("data futura: bannato", () => {
    expect(isBanActive("2026-11-16T11:58:04.500Z", NOW)).toBe(true);
  });

  it("data passata: non bannato", () => {
    expect(isBanActive("2026-11-01T00:00:00Z", NOW)).toBe(false);
  });

  it("stringa non data: non bannato", () => {
    expect(isBanActive("mai", NOW)).toBe(false);
  });
});
