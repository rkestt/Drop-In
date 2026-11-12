import { describe, expect, it } from "vitest";
import {
  formatSubmissionDate,
  isPendingSubmission,
  mapMySubmission,
  type MySubmissionRow,
} from "@/lib/court/my-submissions";

const BASE_ROW: MySubmissionRow = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Campetto Via Napoli",
  sport: "basketball",
  surface_type: "asphalt",
  photo_path: null,
  // Costruttore locale (non ISO UTC): immune al fuso orario del runner.
  created_at: new Date(2026, 10, 12, 12, 0, 0).toISOString(),
  moderation_status: "pending",
};

describe("sport label via mapMySubmission", () => {
  it("maps a known sport", () => {
    expect(mapMySubmission(BASE_ROW).sportLabel).toBe("Basket");
  });
  it("joins multi-sport values", () => {
    expect(
      mapMySubmission({ ...BASE_ROW, sport: "basketball;soccer" }).sportLabel
    ).toBe("Basket · Calcio");
  });
  it("falls back for null sport", () => {
    expect(mapMySubmission({ ...BASE_ROW, sport: null }).sportLabel).toBe(
      "Sport non specificato"
    );
  });
});

describe("formatSubmissionDate", () => {
  it("formats it-IT as '12 nov 2026'", () => {
    expect(formatSubmissionDate(new Date(2026, 10, 12, 12, 0, 0).toISOString())).toBe(
      "12 nov 2026"
    );
  });
  it("returns empty string for invalid input", () => {
    expect(formatSubmissionDate("not-a-date")).toBe("");
  });
});

describe("isPendingSubmission", () => {
  it.each(["approved", "rejected", "duplicate", null, undefined])(
    "is false for %s",
    (status) => {
      expect(isPendingSubmission(status)).toBe(false);
    }
  );
  it("is true only for pending", () => {
    expect(isPendingSubmission("pending")).toBe(true);
  });
});

describe("mapMySubmission", () => {
  it("maps every field, keeping nulls as null", () => {
    const item = mapMySubmission(BASE_ROW);
    expect(item).toEqual({
      id: BASE_ROW.id,
      name: "Campetto Via Napoli",
      sport: "basketball",
      sportLabel: "Basket",
      surface: "asphalt",
      photoPath: null,
      submittedLabel: "12 nov 2026",
      pending: true,
    });
  });
  it("marks non-pending rows as not editable", () => {
    const item = mapMySubmission({ ...BASE_ROW, moderation_status: "approved" });
    expect(item.pending).toBe(false);
  });
  it("labels null sport as unspecified", () => {
    const item = mapMySubmission({ ...BASE_ROW, sport: null });
    expect(item.sport).toBeNull();
    expect(item.sportLabel).toBe("Sport non specificato");
  });
});
