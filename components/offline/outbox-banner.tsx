"use client";

import { Button } from "@/components/ui/button";

/**
 * Banner outbox offline (stati 02 e 06, stesso linguaggio visivo di
 * `connection-banner.tsx`: solo token, `role="status"`, `aria-live="polite"`).
 * - Coda vuota → niente (null).
 * - Offline con coda → conteggio + "verranno inviate appena torni online".
 * - Online con coda → conteggio + "Riprova ora" (44px via Button sm).
 * - Invio in corso → "Invio in corso…".
 */
export function OutboxBanner({
  pending,
  sending,
  online,
  onRetry,
}: {
  pending: number;
  sending: boolean;
  online: boolean;
  onRetry: () => void;
}) {
  if (pending <= 0) return null;

  const countLabel =
    pending === 1
      ? "1 operazione in coda"
      : `${pending} operazioni in coda`;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="outbox-banner"
      className="rounded-card border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-4"
    >
      <p className="text-sm font-semibold text-[var(--text-primary)]">
        {sending
          ? "Invio in corso…"
          : online
            ? `${countLabel}, invio automatico appena possibile.`
            : `${countLabel}, verranno inviate appena torni online.`}
      </p>
      {!sending && online && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="primary" onClick={onRetry}>
            Riprova ora
          </Button>
        </div>
      )}
    </div>
  );
}
