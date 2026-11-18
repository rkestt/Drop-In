import { describe, expect, it } from "vitest";
import {
  DELETED_PLAYER_LABEL,
  getInitials,
  isBanActive,
  resolveNickname,
} from "@/lib/profile/utils";

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

describe("resolveNickname", () => {
  // #94: i profili possono sparire (delete account) e le lobby restano.
  const nicknames = new Map<string, string | null>([
    ["u1", "Luca"],
    ["u2", null],
  ]);

  it("riga presente: nickname com'è", () => {
    expect(resolveNickname(nicknames, "u1")).toBe("Luca");
  });

  it("riga presente senza nickname: null, non 'eliminato'", () => {
    expect(resolveNickname(nicknames, "u2")).toBeNull();
  });

  it("riga assente: profilo eliminato, mai undefined", () => {
    expect(resolveNickname(nicknames, "sparito")).toBe(DELETED_PLAYER_LABEL);
    expect(DELETED_PLAYER_LABEL).toBe("Giocatore eliminato");
  });

  it("mappa vuota (nessun profilo risolto): etichetta, non crash", () => {
    expect(resolveNickname(new Map(), "u1")).toBe(DELETED_PLAYER_LABEL);
  });
});
