export interface Court {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string | null;
  sport?: string | null;
  zone?: string | null;
}

export interface CourtCache {
  data: Court[];
  timestamp: number;
  version: 1;
}

export interface LobbiesCache {
  data: LobyCacheItem[];
  timestamp: number;
  version: 1;
}

export interface LobyCacheItem {
  id: string;
  court_id: string;
  start_time: string;
  max_players: number;
  status: string;
  participants_count: number;
}

export const CACHE_VERSION = 1;
export const CACHE_KEY_COURTS = "dropin_courts_v1";
export const CACHE_KEY_LOBBIES = "dropin_lobbies_v1";
export const CACHE_TTL_COURTS = 60 * 60 * 1000;
export const CACHE_TTL_LOBBIES = 5 * 60 * 1000;

export const USE_COURT_CACHE = true;