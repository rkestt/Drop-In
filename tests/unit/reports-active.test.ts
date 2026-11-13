import { describe, expect, it } from "vitest";
import {
  activeReports,
  categoryLabel,
  findOwnActiveReport,
  formatReportExpiry,
  isActiveReport,
  reportExpiryFromNow,
  REPORT_TTL_MS,
} from "@/lib/reports/active";

const NOW = new Date("2026-11-10T10:00:00Z");
const FUTURE = new Date(NOW.getTime() + 60_000).toISOString();
const PAST = new Date(NOW.getTime() - 60_000).toISOString();

describe("isActiveReport", () => {
  it("attiva quando expires_at è nel futuro", () => {
    expect(isActiveReport({ expires_at: FUTURE }, NOW)).toBe(true);
  });

  it("scaduta quando expires_at è nel passato", () => {
    expect(isActiveReport({ expires_at: PAST }, NOW)).toBe(false);
  });

  it("non attiva senza expires_at", () => {
    expect(isActiveReport({ expires_at: null }, NOW)).toBe(false);
  });
});

describe("activeReports", () => {
  it("tiene solo le non scadute", () => {
    const out = activeReports(
      [
        { expires_at: FUTURE, category: "other" },
        { expires_at: PAST, category: "lighting" },
        { expires_at: null, category: "other" },
      ],
      NOW,
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.category).toBe("other");
  });
});

describe("categoryLabel", () => {
  it("etichetta le 5 categorie del CHECK DB", () => {
    expect(categoryLabel("broken_hoop")).toBe("Canestro rotto");
    expect(categoryLabel("wet_court")).toBe("Campo bagnato");
    expect(categoryLabel("lighting")).toBe("Illuminazione");
    expect(categoryLabel("occupied")).toBe("Occupato");
    expect(categoryLabel("other")).toBe("Altro");
  });

  it("categoria sconosciuta: passa invariata, mai crash", () => {
    expect(categoryLabel("meteorite")).toBe("meteorite");
  });
});

describe("formatReportExpiry", () => {
  it("formato UI it-IT come da copy approvata (d15)", () => {
    // TZ del runner: la regex accetta qualsiasi ora, fissa solo la forma.
    const out = formatReportExpiry("2026-11-16T19:40:00+01:00");
    expect(out).toMatch(/^\d{1,2} \p{L}{3,4}, \d{2}:\d{2}$/u);
    expect(out).toContain("nov");
  });

  it("ora pinnata a Roma, non al fuso del runner", () => {
    // 10:00Z di novembre = 11:00 a Roma; in UTC renderebbe "10:00".
    expect(formatReportExpiry("2026-11-16T10:00:00.000Z")).toBe(
      "16 nov, 11:00"
    );
  });
});

describe("findOwnActiveReport", () => {
  const mine = { expires_at: FUTURE, category: "other", user_id: "u1" };
  const mineExpired = { expires_at: PAST, category: "other", user_id: "u1" };
  const theirs = { expires_at: FUTURE, category: "lighting", user_id: "u2" };

  it("trova la segnalazione attiva dell'utente", () => {
    expect(findOwnActiveReport([theirs, mine], "u1", NOW)).toBe(mine);
  });

  it("ignora quelle scadute", () => {
    expect(findOwnActiveReport([mineExpired], "u1", NOW)).toBeUndefined();
  });

  it("ignora quelle di altri utenti", () => {
    expect(findOwnActiveReport([theirs], "u1", NOW)).toBeUndefined();
  });

  it("senza utente non trova nulla", () => {
    expect(findOwnActiveReport([mine], null, NOW)).toBeUndefined();
  });
});

describe("reportExpiryFromNow", () => {
  it("scade a +48h", () => {
    const out = new Date(reportExpiryFromNow(NOW)).getTime();
    expect(out - NOW.getTime()).toBe(REPORT_TTL_MS);
  });
});
