"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  className,
}: BottomSheetProps) {
  const sheetRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const startY = React.useRef(0);
  const currentY = React.useRef(0);

  // Focus trap: store previously focused element
  const previousFocus = React.useRef<HTMLElement | null>(null);

  // Trap focus inside the sheet when open
  React.useEffect(() => {
    if (!open || !sheetRef.current) return;

    const focusableElements = sheetRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleTabKey);
    return () => document.removeEventListener("keydown", handleTabKey);
  }, [open]);

  // Manage focus and body scroll
  React.useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement as HTMLElement;
      document.body.style.overflow = "hidden";

      // Focus the sheet or first focusable element after animation
      const timer = setTimeout(() => {
        const focusable = sheetRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        focusable?.focus();
      }, 350);

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = "";
        previousFocus.current?.focus();
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [open]);

  // Escape key to close
  React.useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    if (diff > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${diff}px)`;
    }
  };

  const handleTouchEnd = () => {
    const diff = currentY.current - startY.current;
    if (diff > 80) {
      onClose();
    } else if (sheetRef.current) {
      sheetRef.current.style.transform = "";
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 transition-opacity"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClose();
          }
        }}
        aria-hidden="true"
        tabIndex={-1}
      />
      {/* Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          "relative w-full max-w-[720px] mx-auto bg-[var(--bg-elevated)] rounded-t-[20px] shadow-lg transform transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] translate-y-0 pb-safe",
          className
        )}
        style={{
          animation: "slideUp 300ms cubic-bezier(0.25, 1, 0.5, 1)",
        }}
        tabIndex={-1}
      >
        {/* Handle bar - increased touch target */}
        <div
          className="flex justify-center pt-3 pb-3 cursor-grab active:cursor-grabbing min-h-[44px]"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          role="button"
          aria-label="Trascina verso il basso per chiudere"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onClose();
            }
          }}
        >
          <div className="w-10 h-1.5 rounded-full bg-[var(--text-muted)]/30" />
        </div>
        {title && (
          <div className="px-5 pt-2 pb-3">
            <h2
              id={titleId}
              className="text-xl font-semibold font-[family-name:var(--font-syne)] text-[var(--text-primary)]"
            >
              {title}
            </h2>
          </div>
        )}
        <div className="px-5 pb-6">{children}</div>
      </div>
      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        @keyframes slideDown {
          from {
            transform: translateY(0);
          }
          to {
            transform: translateY(100%);
          }
        }
      `}</style>
    </div>
  );
}
