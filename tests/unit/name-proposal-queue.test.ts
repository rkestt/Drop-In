import { describe, expect, it } from "vitest";
import {
  mapNameProposal,
  type NameProposalRow,
} from "@/lib/moderation/queue";

const NOW = new Date("2026-11-13T10:00:00.000Z");

const BASE_ROW: NameProposalRow = {
  id: "22222222-2222-2222-2222-222222222222",
  court_id: "11111111-1111-1111-1111-111111111111",
  proposed_name: "Campetto dell'Arte",
  proposer_id: "33333333-3333-3333-3333-333333333333",
  created_at: "2026-11-13T08:00:00.000Z",
  courts: {
    name: "Spazio verde",
    address: "Via dell'Arte 24, Roma",
    is_auto_name: true,
  },
};

describe("mapNameProposal", () => {
  it("compone riga con nickname, età e flag automatico", () => {
    const item = mapNameProposal(BASE_ROW, "marco_rm", NOW);
    expect(item.id).toBe(BASE_ROW.id);
    expect(item.courtId).toBe(BASE_ROW.court_id);
    expect(item.currentName).toBe("Spazio verde");
    expect(item.isAutoName).toBe(true);
    expect(item.proposedName).toBe("Campetto dell'Arte");
    expect(item.proposerLabel).toBe("marco_rm");
    expect(item.address).toBe("Via dell'Arte 24, Roma");
    expect(item.submittedAgo).toBe("2 ore fa");
  });
  it("nickname assente diventa 'un giocatore'", () => {
    expect(mapNameProposal(BASE_ROW, null, NOW).proposerLabel).toBe("un giocatore");
    expect(mapNameProposal(BASE_ROW, "  ", NOW).proposerLabel).toBe("un giocatore");
  });
  it("corte senza nome resta leggibile", () => {
    const item = mapNameProposal(
      { ...BASE_ROW, courts: { name: null, address: null, is_auto_name: false } },
      "lu",
      NOW,
    );
    expect(item.currentName).toBe("Campo senza nome");
    expect(item.address).toBeNull();
    expect(item.isAutoName).toBe(false);
  });
});
