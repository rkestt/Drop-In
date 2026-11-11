"use client";

import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

export interface JoinLobbyInfo {
  courtName: string;
  startTime: string;
  freeSpots: number;
  maxPlayers: number;
  /** Karma reale dell'utente; il DB non ha una soglia per lobby (vedi spec). */
  userKarma: number | null;
  bannedUntil: string | null;
}

/**
 * Conferma join (prototipo d12, stato "join"): riepilogo campo/orario/posti
 * + karma reale + regola no-show. Una sola CTA primaria ("Entra").
 * Bannato/karma basso: il motivo con data reale, bottone disabilitato.
 */
export function JoinLobbyDrawer({
  open,
  onClose,
  info,
  joining,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  info: JoinLobbyInfo;
  joining: boolean;
  onConfirm: () => void;
}) {
  const banned =
    info.bannedUntil != null && new Date(info.bannedUntil) > new Date();
  const lowKarma = (info.userKarma ?? 90) < 50;
  const blocked = banned || lowKarma;

  const day = new Date(info.startTime).toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const time = new Date(info.startTime).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Drawer open={open} onClose={onClose} title="Unisciti alla lobby">
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">{info.courtName}</p>

        <dl className="overflow-hidden rounded-card border border-[var(--border)] bg-[var(--bg-surface)]">
          <div className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
            <dt className="text-[var(--text-muted)]">Campo</dt>
            <dd className="text-end font-semibold text-[var(--text-primary)]">
              {info.courtName}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-[var(--border)] px-4 py-2.5 text-sm">
            <dt className="text-[var(--text-muted)]">Orario</dt>
            <dd className="text-end font-semibold text-[var(--text-primary)]">
              <span className="capitalize">{day}</span>, {time}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-[var(--border)] px-4 py-2.5 text-sm">
            <dt className="text-[var(--text-muted)]">Posti liberi</dt>
            <dd className="text-end font-semibold text-[var(--text-primary)]">
              {info.freeSpots} su {info.maxPlayers}
            </dd>
          </div>
        </dl>

        {blocked ? (
          <div
            className="rounded-card border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-sm"
            role="alert"
          >
            {banned ? (
              <p className="text-[var(--text-primary)]">
                Sei sospeso fino a{" "}
                {new Date(info.bannedUntil as string).toLocaleDateString("it-IT", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
                : due check-in non rispettati.
              </p>
            ) : (
              <p className="text-[var(--text-primary)]">
                Karma {info.userKarma}, sotto la soglia di 50. Torna sopra 50
                con un check-in rispettato.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">
            Il tuo karma è {info.userKarma ?? "—"}: puoi entrare. Se non ti
            presenti perdi 3 punti.
          </p>
        )}

        <div className="flex flex-col gap-2 pt-1">
          <Button
            variant="primary"
            className="min-h-11 w-full"
            onClick={onConfirm}
            disabled={blocked || joining}
          >
            {joining ? "Entrata…" : "Entra"}
          </Button>
          <Button
            variant="secondary"
            className="min-h-11 w-full"
            onClick={onClose}
            disabled={joining}
          >
            Annulla
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
