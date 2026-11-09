"use client";

import { Toaster as SonnerToaster } from "sonner";

// Stacco dal bordo superiore: 16px + safe-area (notch), così il toast
// non finisce sotto la notch e resta sopra la bottom nav (è in alto).
const TOAST_OFFSET = "calc(env(safe-area-inset-top, 0px) + 16px)";

// Unico punto di mount dei toast non bloccanti (root layout).
// Tema dark fisso: l'app ha un solo tema; i colori arrivano dai token
// via CSS (`app/globals.css`), non dai default della libreria.
export function Toaster() {
  return (
    <SonnerToaster
      theme="dark"
      position="top-center"
      closeButton
      richColors={false}
      expand={false}
      visibleToasts={1}
      offset={TOAST_OFFSET}
      mobileOffset={TOAST_OFFSET}
      toastOptions={{
        classNames: {
          toast:
            "bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border)] rounded-card font-[family-name:var(--font-source-sans)]",
          title: "text-[var(--text-primary)]",
          description: "text-[var(--text-secondary)]",
          closeButton:
            "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-primary)]",
        },
      }}
    />
  );
}
