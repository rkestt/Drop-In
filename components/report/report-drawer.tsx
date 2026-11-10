"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  REPORT_CATEGORY_VALUES,
  REPORT_DESCRIPTION_MAX,
  reportSchema,
  type ReportValues,
} from "@/lib/validation/schemas";
import {
  activeReports,
  categoryLabel,
  findOwnActiveReport,
  formatReportExpiry,
  reportExpiryFromNow,
} from "@/lib/reports/active";
import { createClient } from "@/lib/supabase/client";
import { createLogger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { AlertTriangle, CircleAlert, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReportRow {
  id: string;
  category: string;
  expires_at: string | null;
  user_id: string | null;
}

interface ReportDrawerProps {
  open: boolean;
  onClose: () => void;
  courtId: string;
  courtName: string;
  /** Segnalazioni attive del campo (dal server); la scadenza è reale. */
  reports: ReportRow[];
  currentUserId: string | null;
}

const CATEGORY_VALUES = [...REPORT_CATEGORY_VALUES] as const;

export function ReportDrawer({
  open,
  onClose,
  courtId,
  courtName,
  reports,
  currentUserId,
}: ReportDrawerProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    setFocus,
    watch,
    formState: { errors, isSubmitted },
  } = useForm<ReportValues>({
    resolver: zodResolver(reportSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { category: "", description: "" } as unknown as ReportValues,
  });

  const selectedCategory = watch("category");
  const description = watch("description") ?? "";
  const groupRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Conflitto rilevato dal ricontrollo pre-insert (lista server più
  // fresca della prop): mostra "già segnalato" senza duplicare la riga.
  const [confirmedOwn, setConfirmedOwn] = useState<ReportRow | null>(null);
  // Guardia anti-doppio-invio (il disabled non copre due submit ravvicinati).
  const submittingRef = useRef(false);
  const supabase = createClient();
  const log = createLogger("report");

  useEffect(() => {
    if (open) {
      setError(null);
      setConfirmedOwn(null);
      // Bozza azzerata a ogni apertura: i valori si conservano solo
      // dentro il ramo errore-rete (drawer mai chiuso).
      reset({ category: "", description: "" } as unknown as ReportValues);
    }
  }, [open, reset]);

  const visibleReports = activeReports(
    confirmedOwn && !reports.some((r) => r.id === confirmedOwn.id)
      ? [...reports, confirmedOwn]
      : reports,
  );
  const ownReport = findOwnActiveReport(reports, currentUserId) ?? confirmedOwn;

  const selectCategory = (value: (typeof REPORT_CATEGORY_VALUES)[number]) => {
    // Dopo il primo errore la rivalidazione è live (reValidateMode: onChange).
    setValue("category", value, { shouldValidate: isSubmitted });
  };

  const focusFirstError = (fieldErrors: FieldErrors<ReportValues>) => {
    if (fieldErrors.category) {
      groupRef.current?.focus();
    } else if (fieldErrors.description) {
      setFocus("description");
    }
  };

  const onValidSubmit = async (values: ReportValues) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Devi effettuare l'accesso per inviare una segnalazione.");
      }

      // Regola "una sola attiva per utente/campo": il DB non ha un vincolo
      // di unicità, quindi ricontrollo fresco prima dell'insert (anti-race).
      const { data: existing, error: existingError } = await supabase
        .from("court_reports")
        .select("id, category, expires_at, user_id")
        .eq("court_id", courtId)
        .eq("user_id", user.id)
        .gt("expires_at", new Date().toISOString())
        .limit(1)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing) {
        setConfirmedOwn(existing);
        return;
      }

      const expiresAt = reportExpiryFromNow();
      const { error: insertError } = await supabase.from("court_reports").insert({
        court_id: courtId,
        user_id: user.id,
        category: values.category,
        description: values.description || null,
        expires_at: expiresAt,
      });

      if (insertError) throw insertError;

      reset({ category: "", description: "" } as unknown as ReportValues);
      onClose();
      router.refresh();
      toast.success("Segnalazione inviata", {
        description: `Resta attiva fino al ${formatReportExpiry(expiresAt)}.`,
      });
    } catch (err) {
      // Il tecnico va nel log, mai in UI: i messaggi Supabase sono in inglese.
      log.warn("invio segnalazione fallito", {
        courtId,
        message: err instanceof Error ? err.message : String(err),
      });
      setError("network");
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const overLimit = description.length > REPORT_DESCRIPTION_MAX;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Segnala un campo"
      description={courtName}
    >
      {ownReport ? (
        <div className="space-y-4">
          <div className="bg-[var(--bg-surface)] rounded-xl p-4 space-y-2">
            <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">
              Segnalazioni attive
            </p>
            <ul className="space-y-2">
              {visibleReports.map((report) => (
                <li key={report.id} className="space-y-0.5">
                  <span className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                    {categoryLabel(report.category)}
                    {ownReport.id === report.id && (
                      <Badge variant="accent">Tua</Badge>
                    )}
                  </span>
                  <span className="block text-[13px] text-[var(--text-muted)]">
                    {report.expires_at
                      ? `Scade il ${formatReportExpiry(report.expires_at)}`
                      : "Senza scadenza"}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-2.5 p-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)]">
            <Info className="w-5 h-5 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
            <div>
              <p className="font-semibold text-[var(--text-primary)]">
                Hai già segnalato questo campo
              </p>
              <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">
                Puoi inviarne un&apos;altra quando la tua scade.
              </p>
            </div>
          </div>

          <Button type="button" className="w-full" onClick={onClose}>
            Chiudi
          </Button>
        </div>
      ) : (
        <div className="space-y-4" aria-busy={loading || undefined}>
          <p className="text-[13px] leading-snug text-[var(--text-muted)]">
            Vale per le prossime 48 ore: non è una recensione del campo.
          </p>

          {error && (
            <div
              className="flex gap-2.5 p-3 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10"
              role="alert"
            >
              <CircleAlert className="w-5 h-5 shrink-0 text-[var(--danger)]" aria-hidden="true" />
              <div>
                <p className="font-semibold text-[var(--text-primary)]">
                  Non siamo riusciti a inviare la segnalazione.
                </p>
                <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
                  Categoria e dettagli sono ancora qui.
                </p>
              </div>
            </div>
          )}

          <form
            onSubmit={handleSubmit(onValidSubmit, focusFirstError)}
            className="space-y-4"
            noValidate
          >
            <div>
              <p
                id="report-category-label"
                className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium block mb-2"
              >
                Cosa non va
              </p>
              <div
                ref={groupRef}
                className="flex flex-wrap gap-2 rounded-control-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1"
                role="group"
                tabIndex={-1}
                aria-labelledby="report-category-label"
                aria-describedby={
                  errors.category ? "report-category-error" : undefined
                }
              >
                {CATEGORY_VALUES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => selectCategory(value)}
                    disabled={loading}
                    aria-pressed={selectedCategory === value}
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-control-sm text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 disabled:opacity-50",
                      selectedCategory === value
                        ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                        : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "w-2 h-2 rounded-full border",
                        selectedCategory === value
                          ? "border-[var(--accent-foreground)] bg-[var(--accent-foreground)]"
                          : "border-[var(--text-muted)]",
                      )}
                    />
                    {categoryLabel(value)}
                  </button>
                ))}
              </div>
              {errors.category && (
                <p
                  id="report-category-error"
                  role="alert"
                  className="mt-1.5 flex items-start gap-1.5 text-sm text-[var(--danger)]"
                >
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                  {errors.category.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="report-description"
                className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium block mb-1.5"
              >
                Dettagli (facoltativo)
              </label>
              <textarea
                id="report-description"
                {...register("description")}
                rows={3}
                readOnly={loading}
                placeholder="Es. il canestro di destra è senza net."
                aria-invalid={errors.description ? "true" : undefined}
                aria-describedby={
                  errors.description
                    ? `report-description-count report-description-error`
                    : "report-description-count"
                }
                className="flex w-full bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-control px-4 py-3.5 text-base border border-transparent transition-colors placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 min-h-[100px] resize-none"
              />
              <p className="mt-1 flex justify-end">
                <span
                  id="report-description-count"
                  className={cn(
                    "text-[13px] tabular-nums",
                    overLimit
                      ? "text-[var(--danger)] font-semibold"
                      : "text-[var(--text-muted)]",
                  )}
                >
                  <span aria-hidden="true">
                    {description.length}/{REPORT_DESCRIPTION_MAX}
                  </span>
                  <span className="sr-only">
                    {description.length} caratteri su {REPORT_DESCRIPTION_MAX}
                  </span>
                </span>
              </p>
              {errors.description && (
                <p
                  id="report-description-error"
                  role="alert"
                  className="mt-1.5 flex items-start gap-1.5 text-sm text-[var(--danger)]"
                >
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                  {errors.description.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                )}
                {loading ? "Invio…" : error ? "Riprova" : "Invia segnalazione"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={onClose}
                disabled={loading}
              >
                Annulla
              </Button>
            </div>
          </form>
        </div>
      )}
    </Drawer>
  );
}
