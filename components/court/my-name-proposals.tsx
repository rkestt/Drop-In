"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { postgrestErrorFields } from "@/lib/lobbies/join-errors";
import {
  mapMyNameProposal,
  type MyNameProposalItem,
  type MyNameProposalRow,
} from "@/lib/court/name-proposals";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Errore di `withdraw_name_proposal` in italiano (ticket 77: mai raw
 * Postgres/rete in UI). Il trigger parla già italiano (P0001/42501):
 * passa così com'è. Rete → invito a riprovare, resto → fallback generico.
 */
function withdrawErrorMessage(err: unknown): string {
  const { code, message } = postgrestErrorFields(err);
  const raw = `${code ?? ""} ${message ?? ""}`;
  if (
    /failed to fetch|network|timeout|temporar|offline|connection|reset|aborted|econn|enotfound|socket/i.test(
      raw,
    )
  ) {
    return "Connessione assente: controlla la rete e riprova.";
  }
  if ((code === "P0001" || code === "42501") && message.trim() !== "") {
    return message;
  }
  return "Non è stato possibile ritirare.";
}

/**
 * «Nomi che hai proposto» (ticket 106, superficie 3): le proposte di nome
 * dell'utente su `/submit-court`, sotto «Le tue proposte». Stessi stati
 * della spec — In revisione / Accettata / Rifiutata+motivo / Ritirata —
 * con ritiro in due passi dentro la riga, in colore neutro (non
 * distruttivo: la corte esiste già e resta com'è).
 *
 * La sezione compare solo se c'è almeno una riga (stessa regola di
 * MySubmissions: niente blocco vuoto). Bersaglio del link "Proposta in
 * attesa" della scheda: `id="nomi"`.
 */
export function MyNameProposals() {
  const supabase = createClient();

  const [items, setItems] = useState<MyNameProposalItem[] | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const withdrawingRef = useRef(false);
  // Conferma di ritiro: il pannello prende il focus quando compare (il
  // bottone che l'ha aperto viene smontato) e lo restituisce a "Indietro"
  // quando si torna sui propri passi.
  const confirmPanelRef = useRef<HTMLDivElement | null>(null);
  const retractTriggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const restoreRetractFocus = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!auth.user) {
        setItems([]);
        return;
      }
      const { data, error } = await supabase
        .from("court_name_proposals")
        .select("id,court_id,proposed_name,status,moderator_note,created_at,courts(name)")
        .eq("proposer_id", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (cancelled) return;
      if (error) {
        setItems([]);
        return;
      }
      setItems(
        ((data ?? []) as unknown as MyNameProposalRow[])
          .map(mapMyNameProposal)
          .filter((item): item is MyNameProposalItem => item !== null)
      );
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus sulla conferma di ritiro: senza questo, il tap su "Ritira" smonta
  // il bottone e il focus cade sul body (tastiera persa).
  useEffect(() => {
    if (confirmingId != null) {
      confirmPanelRef.current?.focus();
      return;
    }
    if (restoreRetractFocus.current != null) {
      const id = restoreRetractFocus.current;
      restoreRetractFocus.current = null;
      retractTriggerRefs.current.get(id)?.focus();
    }
  }, [confirmingId]);

  const onConfirmWithdraw = async (item: MyNameProposalItem) => {
    if (withdrawingRef.current) return;
    withdrawingRef.current = true;
    setWithdrawing(true);
    try {
      const { error } = await supabase.rpc("withdraw_name_proposal", {
        p_proposal_id: item.id,
      });
      if (error) throw error;
      // Il DB conserva la riga (`withdrawn`, non delete): rilettura, come
      // refreshItem di MySubmissions — vale il DB, non la replica locale.
      const { data } = await supabase
        .from("court_name_proposals")
        .select("id,court_id,proposed_name,status,moderator_note,created_at,courts(name)")
        .eq("id", item.id)
        .single();
      if (data) {
        const fresh = mapMyNameProposal(data as unknown as MyNameProposalRow);
        setItems(
          (prev) =>
            prev?.map((it) => (it.id === item.id ? (fresh ?? it) : it)) ?? prev
        );
      }
      setConfirmingId(null);
      toast.success("Proposta ritirata.");
    } catch (err) {
      toast.error(withdrawErrorMessage(err));
    } finally {
      withdrawingRef.current = false;
      setWithdrawing(false);
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <section
      id="nomi"
      aria-labelledby="my-name-proposals-title"
      className="mt-10 border-t border-[var(--cool-muted)]/20 pt-6 scroll-mt-4"
    >
      <h2
        id="my-name-proposals-title"
        className="text-lg font-semibold font-[family-name:var(--font-syne)] text-[var(--text-primary)] mb-1"
      >
        Nomi che hai proposto
      </h2>
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        In revisione prima di diventare il nome del campo.
      </p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="bg-[var(--bg-surface)] rounded-card p-4"
          >
            {/* Due righe: nome + stato, poi metadati + azione. Su 360px il
                badge sta accanto solo se c'è spazio: il nome va a capo con
                line-clamp a 2, il badge resta shrink-0. */}
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 flex-1 line-clamp-2 text-base font-semibold text-[var(--text-primary)]">
                {item.proposedName}
              </p>
              <Badge variant={item.badgeVariant} className="shrink-0">
                {item.statusLabel}
              </Badge>
            </div>
            {/* Motivo del rifiuto: testo visibile, con "Motivo:" evidenziato. */}
            {item.status === "rejected" && item.moderationNote && (
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                <span className="font-semibold text-[var(--text-primary)]">
                  Motivo:{" "}
                </span>
                {item.moderationNote}
              </p>
            )}
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="min-w-0 flex-1 text-[13px] text-[var(--text-muted)]">
                {item.status === "approved"
                  ? `Ora è il nome del campo · ${item.dateLabel}`
                  : item.status === "withdrawn"
                    ? `Ritirata da te · ${item.dateLabel}`
                    : item.currentName
                      ? `per «${item.currentName}» · ${item.dateLabel}`
                      : item.dateLabel}
              </p>
              {item.pending && confirmingId !== item.id && (
                <Button
                  ref={(element) => {
                    if (element) retractTriggerRefs.current.set(item.id, element);
                    else retractTriggerRefs.current.delete(item.id);
                  }}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  // Mentre una conferma è aperta (o un ritiro è in corso) le
                  // altre righe non offrono il "Ritira": un solo flusso alla
                  // volta, niente tap incrociati.
                  disabled={withdrawing || confirmingId != null}
                  onClick={() => {
                    restoreRetractFocus.current = item.id;
                    setConfirmingId(item.id);
                  }}
                >
                  Ritira
                </Button>
              )}
            </div>

            {item.pending && confirmingId === item.id && (
              <div
                ref={confirmPanelRef}
                tabIndex={-1}
                role="group"
                aria-label="Conferma ritiro proposta"
                className="mt-3 rounded-control border border-[var(--border-strong)] bg-[var(--bg-base)] p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-surface)]"
              >
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Ritirare la proposta?
                </p>
                <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
                  Il nome del campo resta quello di adesso. Puoi proporne un
                  altro quando vuoi.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setConfirmingId(null)}
                    disabled={withdrawing}
                    className="flex-1"
                  >
                    Indietro
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={withdrawing}
                    onClick={() => onConfirmWithdraw(item)}
                    className="flex-1"
                  >
                    {withdrawing ? "Ritiro…" : "Conferma ritiro"}
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
