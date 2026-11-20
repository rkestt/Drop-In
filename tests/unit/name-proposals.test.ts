import { describe, expect, it } from "vitest";
import {
  isSameCourtName,
  mapMyNameProposal,
  mapProposeNameError,
  nameProposalStatusLabel,
  normalizeCourtName,
  type MyNameProposalRow,
} from "@/lib/court/name-proposals";

const BASE_ROW: MyNameProposalRow = {
  id: "22222222-2222-2222-2222-222222222222",
  court_id: "11111111-1111-1111-1111-111111111111",
  proposed_name: "Campetto dell'Arte",
  status: "pending",
  moderator_note: null,
  created_at: new Date(2026, 10, 16, 12, 0, 0).toISOString(),
  courts: { name: "Spazio verde" },
};

describe("nameProposalStatusLabel", () => {
  it("copre i quattro stati", () => {
    expect(nameProposalStatusLabel("pending")).toBe("In revisione");
    expect(nameProposalStatusLabel("approved")).toBe("Accettata");
    expect(nameProposalStatusLabel("rejected")).toBe("Rifiutata");
    expect(nameProposalStatusLabel("withdrawn")).toBe("Ritirata");
  });
  it("stato ignoto resta vuoto", () => {
    expect(nameProposalStatusLabel("archived")).toBe("");
  });
});

describe("mapMyNameProposal", () => {
  it("mappa una pending con badge accent", () => {
    const item = mapMyNameProposal(BASE_ROW);
    expect(item?.status).toBe("pending");
    expect(item?.pending).toBe(true);
    expect(item?.badgeVariant).toBe("accent");
    expect(item?.currentName).toBe("Spazio verde");
  });
  it("approved non è pending e mostra il badge success", () => {
    const item = mapMyNameProposal({ ...BASE_ROW, status: "approved" });
    expect(item?.pending).toBe(false);
    expect(item?.badgeVariant).toBe("success");
  });
  it("rejected conserva la nota con badge danger", () => {
    const item = mapMyNameProposal({
      ...BASE_ROW,
      status: "rejected",
      moderator_note: "Nome già in uso.",
    });
    expect(item?.moderationNote).toBe("Nome già in uso.");
    expect(item?.badgeVariant).toBe("danger");
  });
  it("stato sconosciuto scartato, non spacciato per pending", () => {
    expect(mapMyNameProposal({ ...BASE_ROW, status: "archived" })).toBeNull();
  });
});

describe("isSameCourtName", () => {
  it("ignora spazi e maiuscole", () => {
    expect(isSameCourtName("  spazio   VERDE ", "Spazio verde")).toBe(true);
  });
  it("nomi diversi restano diversi", () => {
    expect(isSameCourtName("Campetto dell'Arte", "Spazio verde")).toBe(false);
  });
  it("normalizza spazi multipli", () => {
    expect(normalizeCourtName("a  b\tc")).toBe("a b c");
  });
});

describe("mapProposeNameError", () => {
  it("uguale all'attuale parla italiano inline", () => {
    expect(
      mapProposeNameError({ code: "P0001", message: "Il nome proposto è uguale a quello attuale." })
        .message,
    ).toBe("È già il nome di questo campo.");
  });
  it("proposta già aperta rimanda alle proprie proposte", () => {
    expect(
      mapProposeNameError({ code: "P0001", message: "Hai già una proposta in attesa per questo campo." })
        .message,
    ).toContain("Le tue proposte");
  });
  it("race sull'indice unico (23505 raw) rimanda alle proprie proposte", () => {
    expect(
      mapProposeNameError({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "court_name_proposals_court_id_proposer_id_status_key"',
      }).message,
    ).toContain("Le tue proposte");
  });
  it("42501 chiede il login", () => {
    expect(mapProposeNameError({ code: "42501", message: "Non autorizzato." }).message).toContain(
      "Accedi",
    );
  });
  it("quota giornaliera (055) → testo del server, mai retry", () => {
    const message = "Hai raggiunto il limite giornaliero di proposte di nome. Riprova domani.";
    const info = mapProposeNameError({ code: "P0001", message });
    expect(info.message).toBe(message);
    expect(info.canRetry).toBe(false);
  });

  it("mai raw Postgres: fallback generico non riprovabile", () => {
    const info = mapProposeNameError({ code: "XX999", message: "kaboom" });
    expect(info.message).toBe("Non siamo riusciti a inviare la proposta.");
    expect(info.canRetry).toBe(false);
  });
});
