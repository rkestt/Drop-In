"use client";

import * as React from "react";
import { Drawer as BaseDrawer } from "@base-ui/react/drawer";
import { cn } from "@/lib/utils";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Drawer del progetto su Base UI (unica primitiva per dialog/drawer).
 *
 * `modal` (default true in Base UI, qui esplicito) attiva: focus trap con
 * ciclo Tab/Shift+Tab, blocco scroll del body, chiusura con Escape e tap sul
 * backdrop, drag oltre soglia (`swipeDirection="down"`), restore focus al
 * trigger/elemento precedente (`initialFocus`/`finalFocus` di default).
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: DrawerProps) {
  return (
    <BaseDrawer.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      modal
      swipeDirection="down"
    >
      <BaseDrawer.Portal>
        <BaseDrawer.Backdrop className="fixed inset-0 z-50 bg-[var(--overlay)]" />
        <BaseDrawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center">
          <BaseDrawer.Popup
            className={cn(
              "w-full max-w-[720px] rounded-t-sheet bg-[var(--bg-elevated)] shadow-lg outline-none pb-safe",
              className
            )}
          >
            {/* Handle visivo 44px, non interattivo: la chiusura da tastiera
                passa da Escape e dai bottoni espliciti. */}
            <div
              className="flex justify-center pt-3 pb-3 min-h-[44px]"
              aria-hidden="true"
            >
              <div className="w-10 h-1.5 rounded-full bg-[var(--text-muted)]/30" />
            </div>
            {title && (
              <div className="px-5 pt-2 pb-3">
                <BaseDrawer.Title className="text-xl font-semibold font-[family-name:var(--font-syne)] text-[var(--text-primary)]">
                  {title}
                </BaseDrawer.Title>
                {description && (
                  <BaseDrawer.Description className="mt-1 text-sm text-[var(--text-secondary)]">
                    {description}
                  </BaseDrawer.Description>
                )}
              </div>
            )}
            <div className="px-5 pb-6">{children}</div>
          </BaseDrawer.Popup>
        </BaseDrawer.Viewport>
      </BaseDrawer.Portal>
    </BaseDrawer.Root>
  );
}
