import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getCachedProfile, setCachedProfile, clearProfileCache } from "@/lib/cache/profile";
import type { ProfileCache } from "@/lib/cache/profile";

export function useUserProfile(userId: string | null) {
  const [profile, setProfile] = useState<ProfileCache | null>(null);
  const [loading, setLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const supabase = createClient();

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) {
        console.warn("[Profile] Fetch error:", error.message);
        const cached = getCachedProfile();
        if (cached?.user_id === userId) {
          setProfile(cached);
          setIsStale(true);
        }
      } else {
        const profileData = {
          ...data,
          timestamp: Date.now(),
          version: 1 as const,
        };
        setCachedProfile(profileData);
        setProfile(profileData);
        setIsStale(false);
      }
    } catch (err) {
      console.warn("[Profile] Fetch failed:", err);
      const cached = getCachedProfile();
      if (cached?.user_id === userId) {
        setProfile(cached);
        setIsStale(true);
      }
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    let cancelled = false;

    const initProfile = async () => {
      // Check cache first
      const cached = getCachedProfile();
      if (cached?.user_id === userId && !cancelled) {
        setProfile(cached);
        setLoading(false);
        setIsStale(true);
      }

      // Fetch fresh
      await fetchProfile();
    };

    initProfile();

    return () => {
      cancelled = true;
    };
  }, [userId, fetchProfile]);

  const refreshProfile = useCallback(async () => {
    setLoading(true);
    await fetchProfile();
  }, [fetchProfile]);

  const updateProfile = useCallback(async (updates: {
    nickname?: string | null;
    avatar_url?: string | null;
  }) => {
    if (!userId || !profile) return false;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) {
        console.error("[Profile] Update failed:", error);
        return false;
      }

      const profileData = {
        ...data,
        timestamp: Date.now(),
        version: 1 as const,
      };
      setCachedProfile(profileData);
      setProfile(profileData);
      return true;
    } catch (err) {
      console.error("[Profile] Update error:", err);
      return false;
    }
  }, [supabase, userId, profile]);

  const clearProfile = useCallback(() => {
    clearProfileCache();
    setProfile(null);
  }, []);

  return {
    profile,
    loading,
    isStale,
    refreshProfile,
    updateProfile,
    clearProfile,
  };
}