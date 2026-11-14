"use client";

import { useMemo, useRef, useState } from "react";
import type { PostgrestError } from "@supabase/supabase-js";
import { CheckCircle2, ClipboardList, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  fetchActiveReportGroups,
  fetchDedupCandidates,
  fetchPendingCourts,
} from "@/lib/moderation/queries";
import type {
  DedupCandidateItem,
  ModerationQueueItem,
  ReportCourtGroup,
} from "@/lib/moderation/queue";
import { cn } from "@/lib/utils";
import { PendingCourtCard } from "./pending-court-card";
import { ReportsSection } from "./reports-section";

type TabId = "courts" | "reports";
const TAB_IDS: TabId[] = ["courts", "reports"];

interface Feedback {
  tone: "success" | "error";
  text: string;
  /** Presente sui fallimenti di un'azione: l'errore resta anche nella riga. */
  courtId?: string;
}

interface ModerationPanelProps {
  initialCourts: ModerationQueueItem[];
  initialQueueError: boolean;
  initialReportGroups: ReportCourtGroup[];
  initialReportsError: boolean;
}

/**
 * Pannello di moderazione (#33): due tab, "Proposte" e "Segnalazioni".
 *
 * - Nessun optimistic update: dopo un RPC la coda viene riletta dal DB; se
 *   l'azione fallisce la riga resta al suo posto con il messaggio del server
 *   (es. `Non autorizzato.` da 42501), senza retry automatici.
 * - Le segnalazioni sono in sola lettura: scadono da sole dopo 48 ore.
 * - Ogni esito passa da una live region; gli errori di riga hanno `role=alert`.
 */
export function ModerationPanel({
  initialCourts,
  initialQueueError,
  initialReportGroups,
  initialReportsError,
}: ModerationPanelProps) {
  // Client Supabase stabile per tutta la vita del pannello: crearlo a ogni
  // render ricreerebbe l'identita' vista dalle callback di refetch.
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<TabId>("courts");
  const [courts, setCourts] = useState<ModerationQueueItem[]>(initialCourts);
  const [queueError, setQueueError] = useState(initialQueueError);
  const [queueLoading, setQueueLoading] = useState(false);
  const [reportGroups, setReportGroups] =
    useState<ReportCourtGroup[]>(initialReportGroups);
  const [reportsError, setReportsError] = useState(initialReportsError);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const busyRef = useRef(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const reportCount = reportGroups.reduce(
    (total, group) => total + group.count,
    0,
  );

  const refreshQueue = async (): Promise<boolean> => {
    const { items, error } = await fetchPendingCourts(supabase);
    if (error) {
      setQueueError(true);
      return false;
    }
    setQueueError(false);
    setCourts(items);
    return true;
  };

  const run = async (
    court: ModerationQueueItem,
    call: () => PromiseLike<{ error: PostgrestError | null }>,
    successText: string,
  ) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusyId(court.id);
    setFeedback(null);
    try {
      const { error } = await call();
      if (error) {
        setFeedback({
          tone: "error",
          text: `Azione non riuscita. ${error.message}`,
          courtId: court.id,
        });
        return;
      }
      const refreshed = await refreshQueue();
      if (refreshed) {
        // La riga su cui si è agito è sparita: il focus sul bottone andrebbe
        // perso sul body. Si torna alla tab della coda, che resta visibile.
        tabRefs.current[0]?.focus();
      }
      setFeedback({
        tone: refreshed ? "success" : "error",
        text: refreshed
          ? successText
          : `${successText} La coda non si è aggiornata: tocca Riprova.`,
      });
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Errore di rete. Riprova.",
        courtId: court.id,
      });
    } finally {
      busyRef.current = false;
      setBusyId(null);
    }
  };

  const approve = (court: ModerationQueueItem) => {
    void run(
      court,
      () => supabase.rpc("approve_court", { p_court_id: court.id }),
      `Campo approvato: ${court.name}.`,
    );
  };

  const reject = (court: ModerationQueueItem, note: string) => {
    const trimmed = note.trim();
    void run(
      court,
      () =>
        supabase.rpc("reject_court", {
          p_court_id: court.id,
          // "" non è un motivo: il DEFAULT NULL vale più di una nota vuota.
          p_note: trimmed === "" ? undefined : trimmed,
        }),
      trimmed === ""
        ? `Proposta rifiutata: ${court.name}.`
        : `Proposta rifiutata: ${court.name}. Motivo: ${trimmed}`,
    );
  };

  const duplicate = (
    court: ModerationQueueItem,
    original: DedupCandidateItem,
  ) => {
    const originalId = original.id;
    if (!originalId) return;
    void run(
      court,
      () =>
        supabase.rpc("mark_duplicate", {
          p_court_id: court.id,
          p_duplicate_of: originalId,
        }),
      `${court.name} è ora segnato come duplicato di ${original.name}.`,
    );
  };

  const loadCandidates = async (court: ModerationQueueItem) => {
    if (court.lat === null || court.lng === null) {
      return { items: [], error: false };
    }
    return fetchDedupCandidates(supabase, court.lat, court.lng);
  };

  const retryQueue = async () => {
    setQueueLoading(true);
    const { items, error } = await fetchPendingCourts(supabase);
    setQueueLoading(false);
    if (error) {
      setQueueError(true);
      return;
    }
    setQueueError(false);
    setCourts(items);
  };

  const retryReports = async () => {
    setReportsLoading(true);
    const { groups, error } = await fetchActiveReportGroups(supabase);
    setReportsLoading(false);
    if (error) {
      setReportsError(true);
      return;
    }
    setReportsError(false);
    setReportGroups(groups);
  };

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Moderazione"
        className="flex gap-2"
        onKeyDown={(event) => {
          if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
          event.preventDefault();
          const direction = event.key === "ArrowRight" ? 1 : -1;
          const next =
            TAB_IDS[
              (TAB_IDS.indexOf(tab) + direction + TAB_IDS.length) % TAB_IDS.length
            ];
          setTab(next);
          tabRefs.current[TAB_IDS.indexOf(next)]?.focus();
        }}
      >
        <button
          ref={(element) => {
            tabRefs.current[0] = element;
          }}
          type="button"
          role="tab"
          id="tab-courts"
          aria-controls="panel-courts"
          aria-selected={tab === "courts"}
          tabIndex={tab === "courts" ? 0 : -1}
          onClick={() => setTab("courts")}
          className={cn(
            "flex min-h-11 items-center gap-1.5 rounded-chip px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]",
            tab === "courts"
              ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
              : "bg-[var(--bg-surface)] text-[var(--text-secondary)]",
          )}
        >
          <ClipboardList className="h-4 w-4" aria-hidden="true" />
          Proposte
          {!queueError && (
            <span className="tabular-nums"> {courts.length}</span>
          )}
        </button>
        <button
          ref={(element) => {
            tabRefs.current[1] = element;
          }}
          type="button"
          role="tab"
          id="tab-reports"
          aria-controls="panel-reports"
          aria-selected={tab === "reports"}
          tabIndex={tab === "reports" ? 0 : -1}
          onClick={() => setTab("reports")}
          className={cn(
            "flex min-h-11 items-center gap-1.5 rounded-chip px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]",
            tab === "reports"
              ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
              : "bg-[var(--bg-surface)] text-[var(--text-secondary)]",
          )}
        >
          <Flag className="h-4 w-4" aria-hidden="true" />
          Segnalazioni
          {!reportsError && (
            <span className="tabular-nums"> {reportCount}</span>
          )}
        </button>
      </div>

      <div
        role="status"
        aria-live="polite"
        className={cn(
          feedback ? "rounded-control border p-3 text-sm" : "sr-only",
          feedback?.tone === "success" &&
            "border-[var(--success)]/40 bg-[var(--success)]/10 text-[var(--success-dark)]",
          feedback?.tone === "error" &&
            "border-[var(--danger)]/40 bg-[var(--danger)]/10 text-[var(--danger-dark)]",
        )}
      >
        {feedback?.text}
      </div>

      <div
        role="tabpanel"
        id="panel-courts"
        aria-labelledby="tab-courts"
        hidden={tab !== "courts"}
      >
        <div className="space-y-3">
          <h2 className="sr-only">Proposte in attesa</h2>
          {queueError && (
            <div
              role="alert"
              className="rounded-card border border-[var(--danger)]/40 bg-[var(--danger)]/10 p-4"
            >
              <p className="text-sm font-semibold text-[var(--danger-dark)]">
                Non riusciamo a caricare la coda.
              </p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Controlla la connessione e riprova.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={retryQueue}
                disabled={queueLoading}
                className="mt-3"
              >
                {queueLoading ? "Caricamento…" : "Riprova"}
              </Button>
            </div>
          )}

          {courts.length === 0 && !queueError ? (
            <div className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-6 text-center">
              <CheckCircle2
                className="mx-auto mb-2 h-8 w-8 text-[var(--text-muted)]"
                aria-hidden="true"
              />
              <p className="text-sm text-[var(--text-secondary)]">
                Nessuna proposta in attesa.
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Le nuove proposte della community arrivano qui.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {courts.map((court) => (
                <PendingCourtCard
                  key={court.id}
                  court={court}
                  busy={busyId === court.id}
                  disabled={busyId !== null}
                  errorText={
                    feedback?.tone === "error" &&
                    feedback.courtId === court.id
                      ? feedback.text
                      : null
                  }
                  onApprove={approve}
                  onReject={reject}
                  onDuplicate={duplicate}
                  loadCandidates={loadCandidates}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <div
        role="tabpanel"
        id="panel-reports"
        aria-labelledby="tab-reports"
        hidden={tab !== "reports"}
      >
        <h2 className="sr-only">Segnalazioni attive</h2>
        <ReportsSection
          groups={reportGroups}
          error={reportsError}
          loading={reportsLoading}
          onRetry={retryReports}
        />
      </div>
    </div>
  );
}
