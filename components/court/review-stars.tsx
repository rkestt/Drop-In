import { Star } from "lucide-react";
import { clampRating } from "@/lib/reviews/format";
import { cn } from "@/lib/utils";

interface ReviewStarsProps {
  rating: number;
  className?: string;
}

/**
 * Stelle di sola lettura (#34). Il rating nel DB è un intero 1..5, quindi
 * niente mezze stelle: la media vive nel riepilogo, non qui.
 * Icone decorative, il valore leggibile è nello `sr-only`.
 */
export function ReviewStars({ rating, className }: ReviewStarsProps) {
  const filled = clampRating(rating) ?? 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden="true"
          className={cn(
            "h-4 w-4",
            n <= filled
              ? "fill-[var(--warning)] text-[var(--warning)]"
              : "text-[var(--text-muted)]"
          )}
        />
      ))}
      <span className="sr-only">
        {filled} {filled === 1 ? "stella" : "stelle"} su 5
      </span>
    </span>
  );
}
