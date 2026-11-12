import Link from "next/link";
import { Bell, ChevronRight, Heart, List, Settings } from "lucide-react";

const LINKS = [
  { href: "/favorites", title: "Campi salvati", Icon: Heart },
  { href: "/lobbies", title: "Le tue lobby", Icon: List },
  { href: "/notifications", title: "Notifiche", Icon: Bell },
  { href: "/settings", title: "Impostazioni", Icon: Settings },
];

/**
 * Scorciatoie: righe-link (non bottoni accent) da 56px con focus visibile.
 * `/notifications` e `/settings` atterrano con d22 e d18; il path coincide
 * con quello previsto da quei ticket.
 */
export function SettingsLinks() {
  return (
    <nav
      aria-label="Scorciatoie"
      className="rounded-card bg-[var(--bg-surface)] overflow-hidden"
    >
      {LINKS.map(({ href, title, Icon }, i) => (
        <Link
          key={href}
          href={href}
          className="flex items-center gap-3 min-h-[56px] px-4 text-[var(--text-primary)] no-underline hover:bg-[var(--bg-elevated)] active:bg-[var(--bg-elevated)] focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] focus-visible:-outline-offset-2"
          style={i > 0 ? { borderTop: "1px solid var(--border)" } : undefined}
        >
          <span
            aria-hidden="true"
            className="inline-flex items-center justify-center w-[34px] h-[34px] shrink-0 rounded-control-sm bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
          >
            <Icon className="w-5 h-5" />
          </span>
          <span className="text-base font-medium">{title}</span>
          <span aria-hidden="true" className="inline-flex ms-auto text-[var(--text-muted)]">
            <ChevronRight className="w-5 h-5" />
          </span>
        </Link>
      ))}
    </nav>
  );
}
