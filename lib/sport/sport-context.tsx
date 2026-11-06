"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  SPORT_STORAGE_KEY,
  fromStorage,
  sportLabel,
  type SportFilter,
} from "@/lib/sport/sports";

interface SportContextValue {
  sport: SportFilter;
  setSport: (s: SportFilter) => void;
  pSport: SportFilter;
  label: string;
}

const SportContext = createContext<SportContextValue | null>(null);

export function SportProvider({ children }: { children: ReactNode }) {
  const [sport, setSportState] = useState<SportFilter>("basketball");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SPORT_STORAGE_KEY);
      setSportState(fromStorage(stored));
    } catch {
      // ignore
    }
  }, []);

  const setSport = useCallback((s: SportFilter) => {
    setSportState(s);
    try {
      window.localStorage.setItem(SPORT_STORAGE_KEY, s === null ? "all" : s);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<SportContextValue>(
    () => ({
      sport,
      setSport,
      pSport: sport,
      label: sportLabel(sport),
    }),
    [sport, setSport]
  );

  return <SportContext.Provider value={value}>{children}</SportContext.Provider>;
}

export function useSport(): SportContextValue {
  const ctx = useContext(SportContext);
  if (!ctx) throw new Error("useSport must be used within SportProvider");
  return ctx;
}
