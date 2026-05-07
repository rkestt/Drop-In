import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";

interface KarmaSectionProps {
  score: number;
  className?: string;
}

const KARMA_TIERS = [
  { min: 0, label: "Bronzo", color: "text-[var(--warning-dark)]", bg: "bg-[var(--warning)]/15", border: "border-[var(--warning)]/30" },
  { min: 60, label: "Argento", color: "text-[var(--text-secondary)]", bg: "bg-[var(--cool-muted)]/20", border: "border-[var(--cool-muted)]/30" },
  { min: 80, label: "Oro", color: "text-[var(--accent)]", bg: "bg-[var(--accent-subtle)]", border: "border-[var(--accent)]/30" },
  { min: 95, label: "Platino", color: "text-[var(--success-dark)]", bg: "bg-[var(--success)]/15", border: "border-[var(--success)]/30" },
];

const KARMA_TIPS = [
  "Presenzia alle partite a cui ti iscrivi",
  "Fai check-in entro 30 min dall'orario della partita",
  "Non abbandonare una partita senza motivo",
];

function getTier(score: number) {
  let tier = KARMA_TIERS[0];
  for (const t of KARMA_TIERS) {
    if (score >= t.min) tier = t;
  }
  return tier;
}

function getNextTier(score: number) {
  for (const t of KARMA_TIERS) {
    if (score < t.min) return t;
  }
  return null;
}

function getProgress(score: number) {
  const tier = getTier(score);
  const next = getNextTier(score);
  if (!next) return 100; // max tier
  const rangeStart = tier.min;
  const rangeEnd = next.min;
  return Math.round(((score - rangeStart) / (rangeEnd - rangeStart)) * 100);
}

export function KarmaSection({ score, className }: KarmaSectionProps) {
  const tier = getTier(score);
  const nextTier = getNextTier(score);
  const progress = getProgress(score);
  const pointsToNext = nextTier ? nextTier.min - score : 0;

  return (
    <div className={cn("bg-[var(--bg-surface)] rounded-2xl p-4 sm:p-5 overflow-hidden", className)}>
      <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium block mb-4">
        Karma
      </label>

      <div className="flex items-center gap-4 mb-4">
        {/* Score circle with badge */}
        <div className="relative flex-shrink-0">
          <div
            className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center font-bold font-[family-name:var(--font-syne)] text-2xl tabular-nums border-2",
              tier.bg,
              tier.color,
              tier.border
            )}
          >
            {score}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant={
                tier.label === "Platino" ? "success" :
                tier.label === "Oro" ? "accent" :
                tier.label === "Argento" ? "default" :
                "warning"
              }
              className="uppercase tracking-wider text-[10px]"
            >
              {tier.label}
            </Badge>
            {nextTier && (
              <span className="text-xs text-[var(--text-muted)]">
                {pointsToNext} punti a {nextTier.label.toLowerCase()}
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="relative h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
            <div
              className={cn("absolute left-0 top-0 h-full rounded-full transition-all duration-500", tier.color.replace("text-", "bg-"))}
              style={{ width: `${progress}%` }}
            />
          </div>
          {nextTier && (
            <div className="flex justify-between mt-0.5">
              <span className="text-[10px] text-[var(--text-muted)]">{score}</span>
              <span className="text-[10px] text-[var(--text-muted)]">{nextTier.min}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tips */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--accent-subtle)]/50">
        <Info className="w-3.5 h-3.5 text-[var(--accent)] mt-0.5 flex-shrink-0" />
        <ul className="space-y-1">
          {KARMA_TIPS.map((tip, i) => (
            <li key={i} className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}