import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "default" | "sm" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-semibold transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2",
          {
            "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]":
              variant === "primary",
            "bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--cool-muted)]":
              variant === "secondary",
            "bg-transparent text-[var(--accent)] hover:bg-[var(--accent-subtle)]":
              variant === "ghost",
            "bg-[var(--danger)] text-white hover:opacity-90": variant === "danger",
            "px-6 py-3.5 rounded-[10px] text-base": size === "default",
            "px-4 py-2.5 rounded-lg text-sm min-h-[44px]": size === "sm",
            "h-12 w-12 rounded-xl": size === "icon",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
