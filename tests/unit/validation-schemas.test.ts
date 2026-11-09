import { describe, expect, it } from "vitest";
import {
  createLobbySchema,
  editProfileSchema,
  reportSchema,
  submitCourtSchema,
} from "@/lib/validation/schemas";

const future = new Date(Date.now() + 60 * 60 * 1000);
const futureLocal = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}-${String(future.getDate()).padStart(2, "0")}T${String(future.getHours()).padStart(2, "0")}:${String(future.getMinutes()).padStart(2, "0")}`;

const past = new Date(Date.now() - 60 * 60 * 1000);
const pastLocal = past.toISOString().slice(0, 16);

describe("createLobbySchema", () => {
  it("rifiuta 1 giocatore (minimo 2)", () => {
    const r = createLobbySchema.safeParse({ startTime: futureLocal, maxPlayers: 1 });
    expect(r.success).toBe(false);
  });

  it("rifiuta 31 giocatori (massimo 30)", () => {
    const r = createLobbySchema.safeParse({ startTime: futureLocal, maxPlayers: 31 });
    expect(r.success).toBe(false);
  });

  it("accetta 10 giocatori con orario futuro", () => {
    const r = createLobbySchema.safeParse({ startTime: futureLocal, maxPlayers: 10 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.maxPlayers).toBe(10);
  });

  it("rifiuta un orario passato", () => {
    const r = createLobbySchema.safeParse({ startTime: pastLocal, maxPlayers: 10 });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toMatch(/futuro/);
    }
  });

  it("bordo: -2 minuti → errore, +2 minuti → ok", () => {
    const fmt = (d: Date) => {
      const p = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    };
    const justPast = fmt(new Date(Date.now() - 2 * 60 * 1000));
    const justFuture = fmt(new Date(Date.now() + 2 * 60 * 1000));
    expect(
      createLobbySchema.safeParse({ startTime: justPast, maxPlayers: 10 }).success
    ).toBe(false);
    const r = createLobbySchema.safeParse({ startTime: justFuture, maxPlayers: 10 });
    expect(r.success).toBe(true);
  });

  it("rifiuta l'orario mancante", () => {
    const r = createLobbySchema.safeParse({ startTime: "", maxPlayers: 10 });
    expect(r.success).toBe(false);
  });
});

describe("editProfileSchema", () => {
  it("accetta il nickname vuoto (azzera il nickname)", () => {
    const r = editProfileSchema.safeParse({ nickname: "   " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.nickname).toBe("");
  });

  it("rifiuta il nickname oltre i 30 caratteri", () => {
    const r = editProfileSchema.safeParse({ nickname: "a".repeat(31) });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toMatch(/30/);
    }
  });

  it("accetta un nickname valido e lo trimma", () => {
    const r = editProfileSchema.safeParse({ nickname: "  play_maker  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.nickname).toBe("play_maker");
  });
});

describe("reportSchema", () => {
  it("rifiuta una categoria non valida", () => {
    const r = reportSchema.safeParse({ category: "meteorite", description: "" });
    expect(r.success).toBe(false);
  });

  it("rifiuta la categoria mancante", () => {
    const r = reportSchema.safeParse({ category: "", description: "" });
    expect(r.success).toBe(false);
  });

  it("accetta ogni categoria prevista dal DB", () => {
    for (const category of ["broken_hoop", "wet_court", "lighting", "occupied", "other"]) {
      expect(reportSchema.safeParse({ category, description: "" }).success).toBe(true);
    }
  });

  it("trimma la descrizione: solo spazi → stringa vuota (payload: null)", () => {
    const r = reportSchema.safeParse({ category: "other", description: "   " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.description).toBe("");
  });
});

describe("submitCourtSchema", () => {
  it("rifiuta senza nome e senza foto", () => {
    const r = submitCourtSchema.safeParse({
      name: "   ",
      sport: "basketball",
      surface: "",
      hasPhoto: false,
    });
    expect(r.success).toBe(false);
  });

  it("accetta senza nome se c'è una foto", () => {
    const r = submitCourtSchema.safeParse({
      name: "   ",
      sport: "basketball",
      surface: "",
      hasPhoto: true,
    });
    expect(r.success).toBe(true);
  });

  it("rifiuta il nome oltre i 120 caratteri", () => {
    const r = submitCourtSchema.safeParse({
      name: "a".repeat(121),
      sport: "basketball",
      surface: "",
      hasPhoto: false,
    });
    expect(r.success).toBe(false);
  });

  it("rifiuta sport e superficie non validi", () => {
    const r = submitCourtSchema.safeParse({
      name: "Campetto",
      sport: "quidditch",
      surface: "lava",
      hasPhoto: false,
    });
    expect(r.success).toBe(false);
  });

  it("accetta un campo completo valido", () => {
    const r = submitCourtSchema.safeParse({
      name: "Campetto Via Napoli",
      sport: "basketball",
      surface: "asphalt",
      hasPhoto: false,
    });
    expect(r.success).toBe(true);
  });
});
