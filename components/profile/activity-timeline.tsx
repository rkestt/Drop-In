"use client";

import { cn } from "@/lib/utils";
import { MapPin, Volleyball } from "lucide-react";
import Link from "next/link";

interface ActivityItem {
  id: string;
  court_name: string;
  court_address: string;
  lobby_type: string; // e.g. "5 vs 5", "3 vs 3"
  checked_in_at: string;
  lobby_id: string;
}

interface ActivityTimelineProps {
  activities: ActivityItem[];
  className?: string;
}

function timeAgo(dateStr: string): string {
  try {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "pochi secondi fa";
    if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? "minuto" : "minuti"} fa`;
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? "ora" : "ore"} fa`;
    if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? "giorno" : "giorni"} fa`;
    return date.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
  } catch {
    return "recentemente";
  }
}

export function ActivityTimeline({ activities, className }: ActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <div className={cn("bg-[var(--bg-surface)] rounded-xl p-5", className)}>
        <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium block mb-4">
          Attività recente
        </label>
        <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center">
            <Volleyball className="w-6 h-6 text-[var(--accent)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
              Nessuna partita ancora
            </p>
            <p className="text-xs text-[var(--text-muted)] max-w-[220px] mx-auto leading-relaxed">
              Unisciti alla tua prima partita per vederla qui!
            </p>
          </div>
          <Link
            href="/"
            className="mt-1 text-xs text-[var(--accent)] font-medium hover:underline"
          >
            Trova un campo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-[var(--bg-surface)] rounded-xl p-5", className)}>
      <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium block mb-4">
        Attività recente
      </label>

      <div className="space-y-0">
        {activities.map((item, index) => (
          <div key={item.id}>
            <Link
              href={`/courts/${item.lobby_id}`}
              className="group flex items-start gap-3 py-3 hover:bg-[var(--bg-elevated)] -mx-3 px-3 rounded-lg transition-colors"
            >
              {/* Icon */}
              <div className="w-8 h-8 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center flex-shrink-0 mt-0.5">
                <Volleyball className="w-4 h-4 text-[var(--accent)]" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
                  {item.court_name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-[var(--text-muted)]">
                    {timeAgo(item.checked_in_at)}
                  </span>
                  <span className="text-[var(--text-muted)]">·</span>
                  <span className="text-xs text-[var(--text-muted)]">{item.lobby_type}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <MapPin className="w-2.5 h-2.5 text-[var(--text-muted)] flex-shrink-0" />
                  <p className="text-[11px] text-[var(--text-muted)] truncate">
                    {item.court_address}
                  </p>
                </div>
              </div>
            </Link>

            {index < activities.length - 1 && (
              <div className="ml-4 w-px h-0 bg-[var(--cool-muted)]/20" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}