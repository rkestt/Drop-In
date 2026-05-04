import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "accent";
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wider",
          {
            "bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--cool-muted)]/20":
              variant === "default",
            "bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent)]/20":
              variant === "accent",
            "bg-[var(--success)]/20 text-[var(--success-dark)] border border-[var(--success)]/25":
              variant === "success",
            "bg-[var(--warning)]/20 text-[var(--warning-dark)] border border-[var(--warning)]/25":
              variant === "warning",
            "bg-[var(--danger)]/20 text-[var(--danger-dark)] border border-[var(--danger)]/25":
              variant === "danger",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge };
