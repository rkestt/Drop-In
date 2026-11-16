"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoginModal } from "@/components/auth/login-modal";
import { ReviewForm } from "@/components/court/review-form";
import { ReviewList } from "@/components/court/review-list";
import {
  formatAverage,
  reviewCountLabel,
  type ReviewItem,
  type ReviewSummary,
} from "@/lib/reviews/format";

interface ReviewsSectionProps {
  courtId: string;
  signedIn: boolean;
  currentUserId: string | null;
  summary: ReviewSummary;
  initialReviews: ReviewItem[];
  /** Recensione già scritta: prefill del form e CTA "Modifica". */
  ownReview: { rating: number; body: string | null } | null;
}

/**
 * Sezione "Recensioni" della scheda campo (#34): riepilogo pubblico sempre
 * visibile, form solo dopo il gate d'ingresso. Da anonimi il pulsante apre
 * il LoginModal esistente, non un form che fallisce a metà.
 */
export function ReviewsSection({
  courtId,
  signedIn,
  currentUserId,
  summary,
  initialReviews,
  ownReview,
}: ReviewsSectionProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const handleEntry = () => {
    if (signedIn) {
      setFormOpen(true);
    } else {
      setLoginOpen(true);
    }
  };

  return (
    <section aria-labelledby="recensioni-heading">
      <h2
        id="recensioni-heading"
        className="mb-3 text-xl font-bold font-[family-name:var(--font-syne)]"
      >
        Recensioni
      </h2>

      <div className="space-y-4">
        {summary.count > 0 ? (
          <div className="flex items-center gap-3">
            {/* Numero in Syne: è l'ancora visiva della sezione, le stelle
                restano nelle righe (il rating è intero, la media no). */}
            <span className="text-display-sm font-bold leading-none font-[family-name:var(--font-syne)] text-[var(--text-primary)]">
              {formatAverage(summary.average)}
            </span>
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
                su 5
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                {reviewCountLabel(summary.count)}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <Star
              className="h-8 w-8 text-[var(--text-muted)]"
              aria-hidden="true"
            />
            <h3 className="mt-2 text-base font-bold text-[var(--text-primary)]">
              Ancora nessuna recensione.
            </h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Scrivi la prima: racconta com&apos;è il campo a chi arriva dopo.
            </p>
          </div>
        )}

        {formOpen ? (
          <ReviewForm
            courtId={courtId}
            initialRating={ownReview?.rating ?? null}
            initialBody={ownReview?.body ?? null}
            onClose={() => setFormOpen(false)}
          />
        ) : (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleEntry}
              aria-describedby={
                signedIn ? undefined : "review-entry-login-hint"
              }
            >
              <Star className="me-1.5 h-4 w-4" aria-hidden="true" />
              {ownReview ? "Modifica la tua recensione" : "Scrivi una recensione"}
            </Button>
            {!signedIn && (
              <span id="review-entry-login-hint" className="sr-only">
                Accedi per recensire
              </span>
            )}
          </>
        )}

        <ReviewList
          courtId={courtId}
          totalCount={summary.count}
          initialReviews={initialReviews}
          currentUserId={currentUserId}
        />
      </div>

      {!signedIn && (
        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      )}
    </section>
  );
}
