"use client";

import { useRef, useState } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  REPORT_CATEGORY_VALUES,
  reportSchema,
  type ReportValues,
} from "@/lib/validation/schemas";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";

const REPORT_CATEGORIES = [
  { value: "broken_hoop", label: "Canestro rotto" },
  { value: "wet_court", label: "Campo bagnato" },
  { value: "lighting", label: "Illuminazione" },
  { value: "occupied", label: "Occupato" },
  { value: "other", label: "Altro" },
] as const;

interface ReportSheetProps {
  open: boolean;
  onClose: () => void;
  courtId: string;
  courtName: string;
}

export function ReportSheet({ open, onClose, courtId, courtName }: ReportSheetProps) {
  // Categoria e descrizione in react-hook-form (schema zod = unica fonte).
  // Restano useState solo per: loading, errori di rete/DB, successo.
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
  const firstCategoryRef = useRef<HTMLButtonElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // Guardia anti-doppio-invio (il disabled non copre due submit ravvicinati).
  const submittingRef = useRef(false);
  const supabase = createClient();

  const selectCategory = (value: (typeof REPORT_CATEGORY_VALUES)[number]) => {
    // Dopo il primo errore la rivalidazione è live (reValidateMode: onChange).
    setValue("category", value, { shouldValidate: isSubmitted });
  };

  const focusFirstError = (fieldErrors: FieldErrors<ReportValues>) => {
    if (fieldErrors.category) {
      firstCategoryRef.current?.focus();
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

      const { error: insertError } = await supabase.from("court_reports").insert({
        court_id: courtId,
        user_id: user.id,
        category: values.category,
        description: values.description || null,
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      });

      if (insertError) throw insertError;

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        reset({ category: "", description: "" } as unknown as ReportValues);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante l'invio.");
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title="Segnala stato campo">
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          {courtName}
        </p>

        {error && (
          <div className="p-3 rounded-control-sm bg-[var(--danger)]/10 text-[var(--danger)] text-sm animate-scale-in" role="alert" aria-live="assertive">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 rounded-control-sm bg-[var(--success)]/10 text-[var(--success)] text-sm animate-scale-in" role="status" aria-live="polite">
            Segnalazione inviata!
          </div>
        )}

        <form onSubmit={handleSubmit(onValidSubmit, focusFirstError)} className="space-y-3" noValidate>
          <div>
            <span
              id="report-category-label"
              className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium block mb-2"
            >
              Categoria
            </span>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-labelledby="report-category-label"
              aria-describedby={errors.category ? "report-category-error" : undefined}
            >
              {REPORT_CATEGORIES.map((cat, i) => (
                <button
                  key={cat.value}
                  ref={i === 0 ? firstCategoryRef : undefined}
                  type="button"
                  onClick={() => selectCategory(cat.value)}
                  aria-pressed={selectedCategory === cat.value}
                  className={`px-3 py-2 rounded-control-sm text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 ${
                    selectedCategory === cat.value
                      ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                      : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            {errors.category && (
              <p id="report-category-error" role="alert" className="mt-1.5 text-sm text-[var(--danger)]">
                {errors.category.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="report-description"
              className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium block mb-1.5"
            >
              Descrizione (opzionale)
            </label>
            <textarea
              id="report-description"
              {...register("description")}
              className="flex w-full bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-control px-4 py-3.5 text-base border border-transparent transition-colors placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 min-h-[100px] resize-none"
              placeholder="Aggiungi dettagli..."
              aria-invalid={errors.description ? "true" : undefined}
              aria-describedby={errors.description ? "report-description-error" : undefined}
            />
            {errors.description && (
              <p id="report-description-error" role="alert" className="mt-1.5 text-sm text-[var(--danger)]">
                {errors.description.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading || success}>
            {loading ? "Invio..." : "Invia segnalazione"}
          </Button>
        </form>
      </div>
    </Drawer>
  );
}
