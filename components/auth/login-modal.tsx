"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomSheet } from "@/components/ui/bottom-sheet";


interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

export function LoginModal({ open, onClose }: LoginModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) {
          if (error.message.toLowerCase().includes("already registered") || error.message.toLowerCase().includes("user already exists")) {
            setError("Email già registrata. Prova ad accedere.");
            setIsSignUp(false);
          } else {
            setError(error.message);
          }
          setLoading(false);
          return;
        }
        setMessage("Controlla la tua email per confermare l'account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onClose();
        window.location.reload();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante l'autenticazione.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);

    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!googleClientId || googleClientId === "your-google-client-id") {
      setError("OAuth non attivo: manca GOOGLE_CLIENT_ID. Contatta l'amministratore o configura le credenziali Google.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={isSignUp ? "Registrati" : "Accedi"}>
      <div className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-[var(--danger)]/10 text-[var(--danger)] text-sm animate-scale-in" role="alert" aria-live="assertive">
            {error}
          </div>
        )}
        {message && (
          <div className="p-3 rounded-lg bg-[var(--success)]/10 text-[var(--success)] text-sm animate-scale-in" role="status" aria-live="polite">
            {message}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-3">
          <Input
            id="login-email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-label="Indirizzo email"
          />
          <Input
            id="login-password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            aria-label="Password"
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Caricamento..." : isSignUp ? "Registrati" : "Accedi"}
          </Button>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--cool-muted)]/20" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[var(--bg-elevated)] px-2 text-[var(--text-muted)]">
              oppure
            </span>
          </div>
        </div>

        <Button
          variant="secondary"
          className="w-full"
          onClick={handleGoogleAuth}
          disabled={loading}
        >
          Continua con Google
        </Button>

        <p className="text-center text-sm text-[var(--text-secondary)]">
          {isSignUp ? "Hai già un account?" : "Non hai un account?"}{" "}
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-[var(--accent)] font-medium hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 rounded px-1"
          >
            {isSignUp ? "Accedi" : "Registrati"}
          </button>
        </p>
      </div>
    </BottomSheet>
  );
}
