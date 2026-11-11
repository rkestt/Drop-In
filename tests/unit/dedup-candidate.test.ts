import { describe, expect, it } from "vitest";
import { dedupCandidateKey, canNavigateToCandidate } from "@/lib/court/dedup-candidate";

describe("dedupCandidateKey", () => {
  it("uses the id when present", () => {
    expect(dedupCandidateKey({ id: "abc-123" }, 0)).toBe("abc-123");
  });
  it("falls back to pending-<index> for masked rows", () => {
    expect(dedupCandidateKey({ id: null }, 0)).toBe("pending-0");
    expect(dedupCandidateKey({ id: null }, 2)).toBe("pending-2");
  });
  it("masked rows get distinct keys", () => {
    const keys = [{ id: null }, { id: null }, { id: null }].map((c, i) =>
      dedupCandidateKey(c, i)
    );
    expect(new Set(keys).size).toBe(3);
  });
});

describe("canNavigateToCandidate", () => {
  it("true with a real id", () => {
    expect(canNavigateToCandidate({ id: "abc-123" })).toBe(true);
  });
  it("false when id is masked (null)", () => {
    expect(canNavigateToCandidate({ id: null })).toBe(false);
  });
  it("false on empty id (never navigates to /courts/)", () => {
    expect(canNavigateToCandidate({ id: "" })).toBe(false);
  });
});
