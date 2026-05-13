"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Plus, MapPin, Zap } from "lucide-react";

interface FABProps {
  onClick: () => void;
  onLongPress?: () => void;
  className?: string;
}

export function FAB({ onClick, onLongPress, className }: FABProps) {
  const [isPressed, setIsPressed] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = (_e: React.TouchEvent) => {
    setIsPressed(true);
    timerRef.current = setTimeout(() => {
      onLongPress?.();
    }, 500);
  };

  const handleTouchEnd = () => {
    setIsPressed(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleTouchCancel = () => {
    setIsPressed(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <button
      onClick={onClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      className={cn(
        "fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg",
        "bg-[var(--accent)] text-white",
        "flex items-center justify-center",
        "transition-all duration-200 ease-out",
        "hover:scale-110 active:scale-95",
        "z-30",
        "touch-manipulation",
        className
      )}
      aria-label="Crea nuova partita"
    >
      <Plus
        className={cn(
          "w-7 h-7 transition-transform duration-200",
          isPressed && "rotate-90 scale-110"
        )}
      />
    </button>
  );
}

interface QuickCreateFABProps {
  onCreateClick: () => void;
  onSelectCourtClick: () => void;
  className?: string;
}

export function QuickCreateFAB({ onCreateClick, onSelectCourtClick, className }: QuickCreateFABProps) {
  const [expanded, setExpanded] = useState(false);

  const handleClick = () => {
    if (expanded) {
      setExpanded(false);
    } else {
      setExpanded(true);
    }
  };

  const handleSelectCourt = () => {
    setExpanded(false);
    onSelectCourtClick();
  };

  return (
    <div className={cn("fixed bottom-6 right-6 z-30", className)}>
      {/* Expanded menu */}
      <div
        className={cn(
          "absolute bottom-16 right-0 mb-2 flex flex-col gap-2",
          "transition-all duration-200 ease-out",
          "opacity-0 translate-y-2 pointer-events-none",
          expanded && "opacity-100 translate-y-0 pointer-events-auto"
        )}
      >
        <button
          onClick={() => {
            setExpanded(false);
            onCreateClick();
          }}
          className={cn(
            "flex items-center gap-2 px-4 py-3 rounded-full",
            "bg-[var(--bg-elevated)] text-[var(--text-primary)]",
            "shadow-lg whitespace-nowrap",
            "hover:bg-[var(--bg-surface)] active:scale-95",
            "transition-all duration-150"
          )}
        >
          <Zap className="w-5 h-5 text-[var(--accent)]" />
          <span className="text-sm font-medium">Crea partita</span>
        </button>

        <button
          onClick={handleSelectCourt}
          className={cn(
            "flex items-center gap-2 px-4 py-3 rounded-full",
            "bg-[var(--bg-elevated)] text-[var(--text-primary)]",
            "shadow-lg whitespace-nowrap",
            "hover:bg-[var(--bg-surface)] active:scale-95",
            "transition-all duration-150"
          )}
        >
          <MapPin className="w-5 h-5 text-[var(--accent)]" />
          <span className="text-sm font-medium">Seleziona campo</span>
        </button>
      </div>

      {/* Main FAB */}
      <button
        onClick={handleClick}
        className={cn(
          "w-14 h-14 rounded-full shadow-lg",
          "bg-[var(--accent)] text-white",
          "flex items-center justify-center",
          "transition-all duration-200 ease-out",
          "hover:scale-110 active:scale-95",
          "relative"
        )}
        aria-label="Menu crea partita"
        aria-expanded={expanded}
      >
        <Plus
          className={cn(
            "w-7 h-7 transition-transform duration-200",
            expanded && "rotate-45"
          )}
        />
      </button>

      {/* Backdrop for expanded state */}
      {expanded && (
        <div
          className="fixed inset-0 -z-10"
          onClick={() => setExpanded(false)}
        />
      )}
    </div>
  );
}