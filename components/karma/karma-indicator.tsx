import { cn } from "@/lib/utils";

interface KarmaIndicatorProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

export function KarmaIndicator({ score, size = "md" }: KarmaIndicatorProps) {
  const status = score >= 80 ? "high" : score >= 50 ? "medium" : "low";
  const label = status === "high" ? "Alto" : status === "medium" ? "Medio" : "Basso";

  const sizeClasses = {
    sm: "w-8 h-8 text-sm",
    md: "w-12 h-12 text-lg",
    lg: "w-16 h-16 text-2xl",
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "rounded-full flex items-center justify-center font-bold font-[family-name:var(--font-syne)] tabular-nums",
          sizeClasses[size],
          {
            "bg-[var(--accent-subtle)] text-[var(--accent)]": status === "high",
            "bg-[var(--warning)]/15 text-[var(--warning)]": status === "medium",
            "bg-[var(--danger)]/15 text-[var(--danger)]": status === "low",
          }
        )}
      >
        {score}
      </div>
      <div>
        <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">
          Karma
        </p>
        <p
          className={cn("text-sm font-medium", {
            "text-[var(--accent)]": status === "high",
            "text-[var(--warning)]": status === "medium",
            "text-[var(--danger)]": status === "low",
          })}
        >
          {label}
        </p>
      </div>
    </div>
  );
}
