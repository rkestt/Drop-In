"use client";

import { useState, type RefObject } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingInputProps {
  value: number | null;
  onChange: (rating: number) => void;
  /** Focus sul primo radio quando zod boccia il rating (focusFirstError). */
  firstInputRef?: RefObject<HTMLInputElement | null>;
  labelledBy: string;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
}

const RATINGS = [1, 2, 3, 4, 5] as const;

/**
 * Controllo stelle 1..5 (#34): radiogroup nativo, non bottoni con stato.
 * Così le frecce e la roving tabindex sono del browser, non codice nostro.
 * Ogni stella ha 44x44 di area tappabile (label) e il valore è scritto in
 * chiaro accanto ("4 di 5"), non affidato al solo colore.
 */
export function StarRatingInput({
  value,
  onChange,
  firstInputRef,
  labelledBy,
  describedBy,
  invalid,
  disabled,
}: StarRatingInputProps) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-required="true"
      aria-invalid={invalid || undefined}
      className="flex flex-wrap items-center gap-x-3 gap-y-1"
      onMouseLeave={() => setHover(null)}
    >
      <div className="flex items-center gap-1">
        {RATINGS.map((n) => {
          const filled = n <= shown;
          return (
            <label
              key={n}
              onMouseEnter={() => setHover(n)}
              className={cn(
                "flex h-11 w-11 cursor-pointer items-center justify-center rounded-control-sm transition-colors",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus-ring)] has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-[var(--bg-elevated)]",
                disabled && "cursor-not-allowed opacity-50"
              )}
            >
              <input
                ref={n === 1 ? firstInputRef : undefined}
                type="radio"
                name="review-rating"
                value={n}
                checked={value === n}
                disabled={disabled}
                onChange={() => onChange(n)}
                aria-label={`${n} ${n === 1 ? "stella" : "stelle"} su 5`}
                className="sr-only"
              />
              <Star
                aria-hidden="true"
                className={cn(
                  "h-7 w-7 transition-colors",
                  filled
                    ? "fill-[var(--warning)] text-[var(--warning)]"
                    : "text-[var(--text-muted)]"
                )}
              />
            </label>
          );
        })}
      </div>
      <p
        aria-live="polite"
        className="text-sm text-[var(--text-secondary)]"
      >
        {value ? `${value} di 5` : "Nessuna stella"}
      </p>
    </div>
  );
}
