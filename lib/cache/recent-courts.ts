import { getItem, setItem } from "./storage";
import type { Court } from "./types";

const CACHE_KEY_RECENT = "dropin_recent_courts";
const MAX_RECENT = 5;

export function getRecentCourts(): Court[] {
  const data = getItem(CACHE_KEY_RECENT);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addRecentCourt(court: Pick<Court, "id" | "name" | "address" | "sport">): void {
  const recent = getRecentCourts();
  const filtered = recent.filter((c) => c.id !== court.id);
  const updated = [{ ...court }, ...filtered].slice(0, MAX_RECENT);
  setItem(CACHE_KEY_RECENT, JSON.stringify(updated));
}

export function clearRecentCourts(): void {
  setItem(CACHE_KEY_RECENT, JSON.stringify([]));
}
