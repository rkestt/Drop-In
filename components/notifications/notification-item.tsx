"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Ban,
  Bell,
  CheckCircle2,
  Clock,
  CloudRain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatRelativeTime,
  notificationKind,
  type NotificationKind,
  type NotificationRow,
} from "@/lib/notifications/link";

const KIND_ICON: Record<NotificationKind, typeof Bell> = {
  lobby: Clock,
  karma: AlertTriangle,
  ban: Ban,
  checkin: CheckCircle2,
  weather: CloudRain,
  neutral: Bell,
};

// Tinte dai token come nel prototipo: lobby → accent, karma → warning,
// ban → danger, check-in → success, meteo → testo secondario.
const KIND_STYLE: Record<NotificationKind, string> = {
  lobby: "bg-[var(--accent-subtle)] text-[var(--accent)]",
  karma: "bg-[var(--warning)]/15 text-[var(--warning-dark)]",
  ban: "bg-[var(--danger)]/15 text-[var(--danger-dark)]",
  checkin: "bg-[var(--success)]/15 text-[var(--success-dark)]",
  weather: "bg-[var(--cool-muted)]/25 text-[var(--text-secondary)]",
  neutral: "bg-[var(--bg-elevated)] text-[var(--text-secondary)]",
};

function goLabel(href: string): string {
  if (href.startsWith("/courts/")) return "Apri campo";
  return "Apri lobby";
}

interface NotificationItemProps {
  notification: NotificationRow;
  /** Href già risolto da `notificationHref`; `null` = resta e mostra il dettaglio. */
  href: string | null;
  /** Offline: righe non interattive, senza segna-come-letto (prototipo). */
  interactive: boolean;
  /** Riga appena arrivata via realtime: flash decorativo 2s. */
  isNew?: boolean;
  onOpen: (notification: NotificationRow) => void;
}

export function NotificationItem({
  notification,
  href,
  interactive,
  isNew = false,
  onOpen,
}: NotificationItemProps) {
  const unread = notification.read_at === null;
  const kind = notificationKind(notification.data);
  const Icon = KIND_ICON[kind];
  const time = formatRelativeTime(notification.sent_at);

  const rowClass = cn(
    "grid grid-cols-[36px_minmax(0,1fr)_auto] items-start gap-3 min-h-[44px] px-4 py-3.5",
    unread && "shadow-[inset_3px_0_0_var(--accent)]",
    isNew && "animate-notification-flash"
  );
  const titleClass = unread
    ? "text-base font-bold leading-snug text-[var(--text-primary)]"
    : "text-base font-medium leading-snug text-[var(--text-secondary)]";
  const bodyClass = unread
    ? "text-sm leading-snug text-[var(--text-secondary)]"
    : "text-sm leading-snug text-[var(--text-muted)]";

  const content = (
    <>
      {unread && <span className="sr-only">Non letta.</span>}
      <span
        aria-hidden="true"
        className={cn(
          "grid place-items-center w-9 h-9 rounded-control",
          KIND_STYLE[kind]
        )}
      >
        <Icon className="w-5 h-5" />
      </span>
      <span className="flex flex-col gap-0.5 min-w-0">
        <span className={titleClass}>{notification.title}</span>
        <span className={bodyClass}>{notification.body}</span>
        <span className="flex items-center justify-between gap-2 mt-1 text-xs text-[var(--text-muted)]">
          {time ? (
            <time
              dateTime={notification.sent_at ?? undefined}
              suppressHydrationWarning
            >
              {time}
            </time>
          ) : (
            <span />
          )}
          {href && interactive && (
            <span className="text-[var(--accent)] font-semibold whitespace-nowrap">
              {goLabel(href)}
            </span>
          )}
        </span>
      </span>
      {unread ? (
        <span aria-hidden="true" className="w-2 h-2 mt-2 rounded-full bg-[var(--accent)]" />
      ) : (
        <span aria-hidden="true" className="w-2" />
      )}
    </>
  );

  if (href && interactive) {
    return (
      <li>
        <Link
          href={href}
          onClick={(event) => {
            event.preventDefault();
            onOpen(notification);
          }}
          className={cn(
            rowClass,
            "hover:bg-[var(--bg-elevated)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
          )}
        >
          {content}
        </Link>
      </li>
    );
  }

  if (interactive) {
    // Senza aria-label: il nome accessibile è il contenuto (titolo, corpo,
    // ora + "Non letta" sr-only) — un'etichetta diversa violerebbe
    // label-content-name-mismatch (WCAG 2.5.3).
    return (
      <li>
        <button
          type="button"
          onClick={() => onOpen(notification)}
          className={cn(
            rowClass,
            "w-full text-left hover:bg-[var(--bg-elevated)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] cursor-pointer"
          )}
        >
          {content}
        </button>
      </li>
    );
  }

  return (
    <li>
      <div className={rowClass}>{content}</div>
    </li>
  );
}
