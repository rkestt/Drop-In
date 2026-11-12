/** Riga lobby come serve a lista e dettaglio: conteggi reali, niente demo. */
export interface LobbyParticipant {
  user_id: string;
  nickname: string | null;
}

export interface LobbySummary {
  id: string;
  court_id: string;
  start_time: string;
  max_players: number;
  status: string;
  court_name: string;
  court_address?: string | null;
  court_sport?: string | null;
  /** Path nel bucket `court-photos` (null = nessuna foto → placeholder). */
  court_photo_path?: string | null;
  participants_count: number;
  participants: LobbyParticipant[];
  is_joined: boolean;
  /** Solo "Vicine": metri dal RPC `nearby_courts`, altrimenti null. */
  distance_m?: number | null;
}
