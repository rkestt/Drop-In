import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getCachedAuth, setCachedAuth, clearAuthCache } from "@/lib/cache/auth";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const supabase = createClient();

  const fetchAuth = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getUser();

      if (error) {
        console.warn("[Auth] Fetch error:", error.message);
        const cached = getCachedAuth();
        if (cached?.user) {
          setUser(cached.user);
          setIsStale(true);
        } else {
          setUser(null);
        }
      } else {
        setCachedAuth(data.user);
        setUser(data.user);
        setIsStale(false);
      }
    } catch (err) {
      console.warn("[Auth] Fetch failed:", err);
      const cached = getCachedAuth();
      if (cached?.user) {
        setUser(cached.user);
        setIsStale(true);
      }
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;

    const initAuth = async () => {
      // Check cache first
      const cached = getCachedAuth();
      if (cached?.user && !cancelled) {
        setUser(cached.user);
        setLoading(false);
        setIsStale(true);
      }

      // Always fetch fresh
      await fetchAuth();
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!cancelled) {
        setUser(session?.user ?? null);
        if (session?.user) {
          setCachedAuth(session.user);
        } else {
          clearAuthCache();
        }
        setIsStale(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase, fetchAuth]);

  const refreshAuth = useCallback(async () => {
    setLoading(true);
    await fetchAuth();
  }, [fetchAuth]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    clearAuthCache();
    setUser(null);
  }, [supabase]);

  return { user, loading, isStale, refreshAuth, logout };
}