export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      courts: {
        Row: {
          id: string;
          osm_id: string | null;
          name: string;
          address: string | null;
          lat: number;
          lng: number;
          surface_type: string | null;
          hoop_count: number | null;
          created_at: string;
          updated_at: string;
          status: string | null;
          location: unknown | null;
        };
        Insert: {
          id?: string;
          osm_id?: string | null;
          name: string;
          address?: string | null;
          lat: number;
          lng: number;
          surface_type?: string | null;
          hoop_count?: number | null;
          created_at?: string;
          updated_at?: string;
          status?: string | null;
          location?: unknown | null;
        };
        Update: {
          id?: string;
          osm_id?: string | null;
          name?: string;
          address?: string | null;
          lat?: number;
          lng?: number;
          surface_type?: string | null;
          hoop_count?: number | null;
          created_at?: string;
          updated_at?: string;
          status?: string | null;
          location?: unknown | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          user_id: string;
          nickname: string | null;
          avatar_url: string | null;
          karma_score: number;
          banned_until: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          nickname?: string | null;
          avatar_url?: string | null;
          karma_score?: number;
          banned_until?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          nickname?: string | null;
          avatar_url?: string | null;
          karma_score?: number;
          banned_until?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lobbies: {
        Row: {
          id: string;
          court_id: string;
          creator_id: string;
          start_time: string;
          max_players: number;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          court_id: string;
          creator_id: string;
          start_time: string;
          max_players: number;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          court_id?: string;
          creator_id?: string;
          start_time?: string;
          max_players?: number;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lobby_participants: {
        Row: {
          id: string;
          lobby_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: {
          id?: string;
          lobby_id: string;
          user_id: string;
          joined_at?: string;
        };
        Update: {
          id?: string;
          lobby_id?: string;
          user_id?: string;
          joined_at?: string;
        };
        Relationships: [];
      };
      check_ins: {
        Row: {
          id: string;
          user_id: string;
          court_id: string;
          lobby_id: string | null;
          lat: number;
          lng: number;
          accuracy: number | null;
          status: string;
          checked_in_at: string;
          checked_out_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          court_id: string;
          lobby_id?: string | null;
          lat: number;
          lng: number;
          accuracy?: number | null;
          status?: string;
          checked_in_at?: string;
          checked_out_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          court_id?: string;
          lobby_id?: string | null;
          lat?: number;
          lng?: number;
          accuracy?: number | null;
          status?: string;
          checked_in_at?: string;
          checked_out_at?: string | null;
        };
        Relationships: [];
      };
      court_reports: {
        Row: {
          id: string;
          court_id: string;
          user_id: string;
          category: string;
          description: string | null;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          court_id: string;
          user_id: string;
          category: string;
          description?: string | null;
          created_at?: string;
          expires_at: string;
        };
        Update: {
          id?: string;
          court_id?: string;
          user_id?: string;
          category?: string;
          description?: string | null;
          created_at?: string;
          expires_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
