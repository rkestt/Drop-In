"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function useMounted() {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const mounted = useMounted();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Cambia tema"
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--cool-muted)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
    >
      {!mounted ? (
        <span className="h-4 w-4" aria-hidden="true" />
      ) : theme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}
