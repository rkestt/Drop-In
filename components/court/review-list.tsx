"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReviewStars } from "@/components/court/review-stars";
import { formatAppDateFull } from "@/lib/datetime";
import { REVIEW_PAGE_SIZE, type ReviewItem } from "@/lib/reviews/format";
import { createClient } from "@/lib/supabase/client";

interface ReviewListProps {
  courtId: string;
  /** `count` della view: dice quando fermare "Mostra altre". */
  totalCount: number;
  initialReviews: ReviewItem[];
  currentUserId: string | null;
}

/**
 * Lista recensioni (#34). Il primo blocco arriva dal server; "Mostra altre"
 * pagina di 5 in 5 con il client browser (RLS identica al server). Il
 * nickname non è embeddabile da PostgREST (FK su auth.users), quindi seconda
 * query su profiles + map, come nelle pagine lobby.
 */
export function ReviewList({
  courtId,
  totalCount,
  initialReviews,
  currentUserId,
}: ReviewListProps) {
  const [reviews, setReviews] = useState(initialReviews);
  const [exhausted, setExhausted] = useState(
    initialReviews.length < REVIEW_PAGE_SIZE
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Il server ha ricaricato (router.refresh dopo un invio): riparte dal
  // primo blocco fresco invece di restare sui dati vecchi.
  useEffect(() => {
    setReviews(initialReviews);
    setExhausted(initialReviews.length < REVIEW_PAGE_SIZE);
    setError(null);
  }, [initialReviews]);

  const hasMore = !exhausted && reviews.length < totalCount;

  const loadMore = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("court_reviews")
        .select("id, user_id, rating, body, created_at")
        .eq("court_id", courtId)
        // Stesso ordine della pagina server: range stabile sul secondario.
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(reviews.length, reviews.length + REVIEW_PAGE_SIZE - 1);
      if (fetchError) throw fetchError;

      const rows = data ?? [];
      const userIds = [...new Set(rows.map((row) => row.user_id))];
      let nicknames = new Map<string, string | null>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, nickname")
          .in("user_id", userIds);
        nicknames = new Map(
          (profiles ?? []).map((p) => [p.user_id, p.nickname] as const)
        );
      }

      const items: ReviewItem[] = rows.map((row) => ({
        id: row.id,
        user_id: row.user_id,
        nickname: nicknames.get(row.user_id) ?? null,
        rating: row.rating,
        body: row.body,
        created_at: row.created_at,
      }));

      setReviews((prev) => {
        const seen = new Set(prev.map((review) => review.id));
        return [...prev, ...items.filter((item) => !seen.has(item.id))];
      });
      if (rows.length < REVIEW_PAGE_SIZE) setExhausted(true);
    } catch {
      setError("Non siamo riusciti a caricare le altre recensioni. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  if (reviews.length === 0) return null;

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {reviews.map((review) => (
          <li
            key={review.id}
            className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-medium text-[var(--text-primary)]">
                {review.nickname ?? "Utente Drop-In"}
              </span>
              {review.user_id === currentUserId && (
                <Badge variant="accent">Tua</Badge>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <ReviewStars rating={review.rating} />
              <span className="text-xs text-[var(--text-muted)]">
                {formatAppDateFull(review.created_at)}
              </span>
            </div>
            {review.body && (
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                {review.body}
              </p>
            )}
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      {hasMore && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={loadMore}
          disabled={loading}
          aria-busy={loading || undefined}
        >
          {loading && (
            <Loader2 className="me-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {loading ? "Caricamento…" : "Mostra altre recensioni"}
        </Button>
      )}
    </div>
  );
}
