import { describe, expect, it } from "vitest";
import {
  APP_TIME_ZONE,
  appDateKey,
  formatAppCloseTime,
  formatAppDate,
  formatAppDateFull,
  formatAppDateTime,
  formatAppDay,
  formatAppTime,
  formatExpiry,
  todayInAppZone,
} from "@/lib/datetime";

// Regressione #78: questi assert passano in QUALSIASI fuso della macchina
// (CI = UTC, browser = Europe/Rome). La vecchia implementazione —
// `toLocale*` senza `timeZone` + `getDate()` locale — in UTC rendeva "12:00"
// e "Ieri" dove Roma dice "13:00" e "Oggi": su CI falliva, in locale no.
describe("fuso fisso Europe/Rome", () => {
  it("APP_TIME_ZONE è Europe/Rome", () => {
    expect(APP_TIME_ZONE).toBe("Europe/Rome");
  });

  it("mezzogiorno UTC di gennaio → 13:00 a Roma", () => {
    expect(formatAppTime("2026-01-15T12:00:00.000Z")).toBe("13:00");
  });

  it("mezzogiorno UTC di luglio (DST) → 14:00 a Roma", () => {
    expect(formatAppTime("2026-07-15T12:00:00.000Z")).toBe("14:00");
  });

  it("23:30Z è già il giorno dopo a Roma (chiave app, non UTC)", () => {
    expect(appDateKey("2026-01-14T23:30:00.000Z")).toBe("2026-01-15");
    expect(appDateKey("2026-01-14T22:30:00.000Z")).toBe("2026-01-14");
  });

  it("formatAppDay: 23:30Z con now del giorno dopo → Oggi, non Ieri", () => {
    const now = new Date("2026-01-15T10:00:00.000Z"); // 11:00 a Roma
    expect(formatAppDay("2026-01-14T23:30:00.000Z", now)).toMatch(/^Oggi, /);
  });

  it("formatAppDay: sera di Roma con now l'indomani → Ieri", () => {
    const now = new Date("2026-01-15T10:00:00.000Z");
    expect(formatAppDay("2026-01-14T20:00:00.000Z", now)).toMatch(/^Ieri, /);
  });

  it("formatAppDay: giorno lontano → solo etichetta, senza Oggi/Ieri", () => {
    const now = new Date("2026-01-15T10:00:00.000Z");
    const out = formatAppDay("2026-01-10T12:00:00.000Z", now);
    expect(out).not.toMatch(/^(Oggi|Ieri), /);
    expect(out).toMatch(/gennaio/);
  });

  it("todayInAppZone segue il fuso app, non quello locale", () => {
    // 00:30 a Roma, ancora il 14 in UTC.
    expect(todayInAppZone(new Date("2026-01-14T23:30:00.000Z"))).toBe(
      "2026-01-15",
    );
  });

  it("formatAppDate è deterministico (data ban/sospensione)", () => {
    expect(formatAppDate("2026-01-15T12:00:00.000Z")).toMatch(
      /15 gennaio/,
    );
  });

  it("formatAppDateFull: 23:30Z è già il giorno dopo a Roma", () => {
    // Chiave al confine: in UTC è ancora il 14, a Roma è il 15.
    expect(formatAppDateFull("2026-01-14T23:30:00.000Z")).toBe(
      "15 gennaio 2026",
    );
  });

  it("formatAppDateTime fissa giorno e ora a Roma", () => {
    // 19:40 +01:00 = 18:40Z → a Roma resta "19:40".
    const out = formatAppDateTime("2026-11-16T19:40:00+01:00");
    expect(out).toMatch(/16 nov.*19:40/);
  });

  it("formatAppCloseTime = inizio + 30 min", () => {
    expect(formatAppCloseTime("2026-01-15T12:00:00.000Z")).toBe("13:30");
  });

  it("formatExpiry resta importabile con la vecchia firma", () => {
    expect(formatExpiry(new Date("2026-01-15T12:00:00.000Z"))).toBe("13:00");
  });
});
