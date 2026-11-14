import { describe, expect, it } from "vitest";
import {
  actionableSubmissionStatuses,
  formatSubmissionDate,
  isActionableSubmission,
  isPendingSubmission,
  latestRejectedNote,
  mapMySubmission,
  submissionStatusLabel,
  type MySubmissionRow,
  type SubmissionNoteRow,
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
    expect(mapMySubmission(BASE_ROW)?.sportLabel).toBe("Basket");
  });
  it("joins multi-sport values", () => {
    expect(
      mapMySubmission({ ...BASE_ROW, sport: "basketball;soccer" })?.sportLabel
    ).toBe("Basket · Calcio");
  });
  it("falls back for null sport", () => {
    expect(mapMySubmission({ ...BASE_ROW, sport: null })?.sportLabel).toBe(
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
      status: "pending",
      statusLabel: "In revisione",
      moderationNote: null,
    });
  });
  it.each(["approved", "duplicate", null, undefined])(
    "returns null for %s (caller drops the row)",
    (status) => {
      // `undefined` non e' nel tipo ma arriva dal JS: il cast lo prova davvero.
      const row = { ...BASE_ROW, moderation_status: status } as MySubmissionRow;
      expect(mapMySubmission(row)).toBeNull();
    }
  );
  it("labels null sport as unspecified", () => {
    const item = mapMySubmission({ ...BASE_ROW, sport: null });
    expect(item?.sport).toBeNull();
    expect(item?.sportLabel).toBe("Sport non specificato");
  });
});

describe("rejected rows (#47)", () => {
  const REJECTED_ROW: MySubmissionRow = {
    ...BASE_ROW,
    moderation_status: "rejected",
    moderation_note: "foto illeggibile",
  };

  it("maps status, label and moderator note", () => {
    const item = mapMySubmission(REJECTED_ROW);
    expect(item?.status).toBe("rejected");
    expect(item?.statusLabel).toBe("Rifiutata");
    expect(item?.moderationNote).toBe("foto illeggibile");
    expect(item?.pending).toBe(false);
  });
  it("keeps a missing note as null", () => {
    const item = mapMySubmission({ ...REJECTED_ROW, moderation_note: null });
    expect(item?.moderationNote).toBeNull();
  });
  it("keeps pending rows without note", () => {
    const item = mapMySubmission(BASE_ROW);
    expect(item?.status).toBe("pending");
    expect(item?.statusLabel).toBe("In revisione");
    expect(item?.moderationNote).toBeNull();
  });
});

describe("latestRejectedNote", () => {
  const COURT = BASE_ROW.id;
  const note = (
    overrides: Partial<SubmissionNoteRow> & { created_at: string }
  ): SubmissionNoteRow => ({
    court_id: COURT,
    moderation_note: "vecchia nota",
    status: "rejected",
    ...overrides,
  });

  it("returns null with no rows", () => {
    expect(latestRejectedNote([], COURT)).toBeNull();
  });
  it("ignores other courts, pending rows and null notes", () => {
    const rows: SubmissionNoteRow[] = [
      { ...note({ created_at: "2026-11-10T10:00:00Z" }), court_id: "other" },
      note({ created_at: "2026-11-11T10:00:00Z", status: "pending", moderation_note: "mai" }),
      note({ created_at: "2026-11-12T10:00:00Z", moderation_note: null }),
    ];
    expect(latestRejectedNote(rows, COURT)).toBeNull();
  });
  it("picks the most recent rejected note", () => {
    const rows: SubmissionNoteRow[] = [
      note({ created_at: "2026-11-10T10:00:00Z", moderation_note: "prima" }),
      note({ created_at: "2026-11-12T10:00:00Z", moderation_note: "ultima" }),
      note({ created_at: "2026-11-11T10:00:00Z", moderation_note: "mezzo" }),
    ];
    expect(latestRejectedNote(rows, COURT)).toBe("ultima");
  });
});

describe("submissionStatusLabel", () => {
  it("labels pending and rejected", () => {
    expect(submissionStatusLabel("pending")).toBe("In revisione");
    expect(submissionStatusLabel("rejected")).toBe("Rifiutata");
  });
  it.each(["approved", "duplicate", null, undefined])(
    "is empty for %s",
    (status) => {
      expect(submissionStatusLabel(status)).toBe("");
    }
  );
});

describe("actionableSubmissionStatuses", () => {
  it("lists only pending (edit/retract); rejected is resubmit-only", () => {
    expect(actionableSubmissionStatuses()).toEqual(["pending"]);
    expect(isActionableSubmission("pending")).toBe(true);
    expect(isActionableSubmission("rejected")).toBe(false);
  });
  it.each(["approved", "duplicate", null, undefined])(
    "is false for %s",
    (status) => {
      expect(isActionableSubmission(status)).toBe(false);
    }
  );
});
