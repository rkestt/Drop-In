import { describe, expect, it } from "vitest";
import { isAtLeast14, parseBirthDate } from "@/lib/profile/age";

// Ora fissa: 20/11/2026 12:00 a Roma (11:00Z, lontano da ogni confine DST).
const NOW = "2026-11-20T12:00:00+01:00";

describe("isAtLeast14", () => {
  it("14 anni esatti oggi: true", () => {
    expect(isAtLeast14("2012-11-20", NOW)).toBe(true);
  });

  it("un giorno prima dei 14: false", () => {
    expect(isAtLeast14("2012-11-21", NOW)).toBe(false);
  });

  it("maggiorenne con margine: true", () => {
    expect(isAtLeast14("2000-05-17", NOW)).toBe(true);
  });

  it("data futura: false", () => {
    expect(isAtLeast14("2027-01-01", NOW)).toBe(false);
  });

  it("oltre 120 anni: false", () => {
    expect(isAtLeast14("1900-01-01", NOW)).toBe(false);
  });

  it("120 anni esatti: ancora valido", () => {
    expect(isAtLeast14("1906-11-20", NOW)).toBe(true);
    expect(isAtLeast14("1906-11-19", NOW)).toBe(false);
  });

  it("stringa vuota o non valida: false", () => {
    expect(isAtLeast14("", NOW)).toBe(false);
    expect(isAtLeast14("   ", NOW)).toBe(false);
    expect(isAtLeast14("mai", NOW)).toBe(false);
    expect(isAtLeast14("20/11/2012", NOW)).toBe(false);
    expect(isAtLeast14("2026-02-30", NOW)).toBe(false);
  });

  it("fuso esplicito: a Roma e' gia' domani, in UTC no", () => {
    // 19/11 23:30Z = 20/11 00:30 a Roma: chi compie gli anni il 20/11 a Roma
    // e' maggiorenne, in UTC (ieri) no.
    expect(isAtLeast14("2012-11-20", "2026-11-19T23:30:00Z")).toBe(true);
    expect(isAtLeast14("2012-11-20", "2026-11-19T23:30:00Z", "UTC")).toBe(
      false
    );
  });
});

describe("parseBirthDate", () => {
  it("trimma e normalizza", () => {
    expect(parseBirthDate("  2012-11-20 ")).toBe("2012-11-20");
  });

  it("rifiuta formati e date impossibili", () => {
    expect(parseBirthDate("")).toBeNull();
    expect(parseBirthDate("20/11/2012")).toBeNull();
    expect(parseBirthDate("2026-13-01")).toBeNull();
    expect(parseBirthDate("2026-02-30")).toBeNull();
    expect(parseBirthDate("2012-2-3")).toBeNull();
  });

  it("accetta il 29/02 bisestile", () => {
    expect(parseBirthDate("2012-02-29")).toBe("2012-02-29");
    expect(parseBirthDate("2011-02-29")).toBeNull();
  });
});
