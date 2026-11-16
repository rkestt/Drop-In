"use client";

import { useRef, useState } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertTriangle, CircleAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StarRatingInput } from "@/components/court/review-star-input";
import { createClient } from "@/lib/supabase/client";
import { bodyToNull, clampRating } from "@/lib/reviews/format";
import { reviewErrorMessage } from "@/lib/reviews/errors";
import {
  REVIEW_BODY_MAX,
  reviewSchema,
  type ReviewValues,
} from "@/lib/validation/schemas";
import { cn } from "@/lib/utils";

interface ReviewFormProps {
  courtId: string;
  /** Recensione già scritta dall'utente: prefill e "Aggiorna". */
  initialRating: number | null;
  initialBody: string | null;
  onClose: () => void;
}

/**
 * Form recensione (#34), inline sotto al riepilogo — non un drawer.
 * Upsert su (user_id, court_id): il DB ha già la riga unica, quindi scrivere
 * due volte aggiorna invece di duplicare (23505 impossibile da qui).
 */
export function ReviewForm({
  courtId,
  initialRating,
  initialBody,
  onClose,
}: ReviewFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const ratingInputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    watch,
    formState: { errors, isSubmitted },
  } = useForm<ReviewValues>({
    resolver: zodResolver(reviewSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      rating: clampRating(initialRating) ?? undefined,
      body: initialBody ?? "",
    } as unknown as ReviewValues,
  });

  const rating = clampRating(watch("rating"));
  const body = watch("body") ?? "";
  const isUpdate = clampRating(initialRating) != null;
  const overLimit = body.length > REVIEW_BODY_MAX;

  // Dopo il primo errore la rivalidazione è live: la stella si accende e
  // l'errore sparisce senza un secondo submit.
  const selectRating = (value: number) => {
    setValue("rating", value, { shouldValidate: isSubmitted });
  };

  // Stesso pattern del report drawer: il primo campo in errore prende il
  // focus. Il rating non è un input registrato, quindi il focus va al radio.
  const focusFirstError = (fieldErrors: FieldErrors<ReviewValues>) => {
    if (fieldErrors.rating) {
      ratingInputRef.current?.focus();
    } else if (fieldErrors.body) {
      setFocus("body");
    }
  };

  const onValidSubmit = async (values: ReviewValues) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("La sessione è scaduta: accedi di nuovo per recensire.");
        return;
      }

      // Una recensione per (utente, campo): l'upsert usa il vincolo unico.
      const { error: saveError } = await supabase
        .from("court_reviews")
        .upsert(
          {
            court_id: courtId,
            user_id: user.id,
            rating: values.rating,
            // Vuoto o soli spazi = NULL: il CHECK della 033 rifiuta '   '.
            body: bodyToNull(values.body),
          },
          { onConflict: "user_id,court_id" }
        );

      if (saveError) {
        // Il codice diventa copy italiano, mai il testo grezzo di Supabase.
        setError(reviewErrorMessage(saveError.code));
        return;
      }

      router.refresh();
      onClose();
      toast.success(
        isUpdate ? "Recensione aggiornata" : "Recensione pubblicata"
      );
    } catch {
      setError("Salvataggio non riuscito. Riprova.");
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onValidSubmit, focusFirstError)}
      aria-busy={loading || undefined}
      className="animate-fade-in-up space-y-4 rounded-card border border-[var(--border)] bg-[var(--bg-elevated)] p-4"
      noValidate
    >
      {error && (
        <div
          role="alert"
          className="flex gap-2.5 rounded-card border border-[var(--danger)]/40 bg-[var(--danger)]/10 p-3"
        >
          <CircleAlert
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--danger-dark)]"
            aria-hidden="true"
          />
          <div>
            <p className="font-semibold text-[var(--text-primary)]">
              Non siamo riusciti a salvare.
            </p>
            <p className="mt-0.5 text-sm text-[var(--danger-dark)]">{error}</p>
            <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
              Valutazione e testo restano qui: riprova.
            </p>
          </div>
        </div>
      )}

      <div>
        <p
          id="review-rating-label"
          className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]"
        >
          La tua valutazione
        </p>
        <StarRatingInput
          value={rating}
          onChange={selectRating}
          firstInputRef={ratingInputRef}
          labelledBy="review-rating-label"
          describedBy={errors.rating ? "review-rating-error" : undefined}
          invalid={!!errors.rating}
          disabled={loading}
        />
        {errors.rating && (
          <p
            id="review-rating-error"
            role="alert"
            className="mt-1.5 flex items-start gap-1.5 text-sm text-[var(--danger)]"
          >
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            {errors.rating.message}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="review-body"
          className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]"
        >
          Com&apos;è il campo? (facoltativo)
        </label>
        <textarea
          id="review-body"
          {...register("body")}
          rows={3}
          readOnly={loading}
          placeholder="Es. asfalto nuovo, canestro senza net, si gioca fino a tardi."
          aria-invalid={errors.body ? "true" : undefined}
          aria-describedby={
            [
              "review-body-hint",
              "review-body-count",
              errors.body ? "review-body-error" : null,
            ]
              .filter(Boolean)
              .join(" ")
          }
          className="flex min-h-[100px] w-full resize-none rounded-control border border-transparent bg-[var(--bg-surface)] px-4 py-3.5 text-base text-[var(--text-primary)] transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-elevated)]"
        />
        <p id="review-body-hint" className="sr-only">
          Facoltativo, massimo {REVIEW_BODY_MAX} caratteri. Racconta com&apos;è
          il canestro, la superficie e quando si gioca.
        </p>
        <p className="mt-1 flex justify-end">
          <span
            id="review-body-count"
            className={cn(
              "text-sm tabular-nums",
              overLimit
                ? "font-semibold text-[var(--danger)]"
                : "text-[var(--text-muted)]"
            )}
          >
            <span aria-hidden="true">
              {body.length}/{REVIEW_BODY_MAX}
            </span>
            <span className="sr-only">
              {body.length} caratteri su {REVIEW_BODY_MAX}
            </span>
          </span>
        </p>
        {errors.body && (
          <p
            id="review-body-error"
            role="alert"
            className="mt-1.5 flex items-start gap-1.5 text-sm text-[var(--danger)]"
          >
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            {errors.body.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        {/* Secondaria, non primary: la CTA primaria della scheda resta il
            check-in, la recensione è un gesto di contorno. */}
        <Button type="submit" variant="secondary" className="w-full" disabled={loading}>
          {loading && (
            <Loader2
              className="me-2 h-4 w-4 animate-spin"
              aria-hidden="true"
            />
          )}
          {loading
            ? "Invio…"
            : error
              ? "Riprova"
              : isUpdate
                ? "Aggiorna recensione"
                : "Pubblica recensione"}
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
  );
}
