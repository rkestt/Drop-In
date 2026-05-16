"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertTriangle, Mail } from "lucide-react";

interface EmailVerificationProps {
  email: string;
  isVerified: boolean;
}

export function EmailVerification({ email, isVerified }: EmailVerificationProps) {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleResend = async () => {
    setLoading(true);
    setError(null);
    setSent(false);

    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    setLoading(false);

    if (resendError) {
      setError(resendError.message);
      return;
    }

    setSent(true);
  };

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <Mail className="w-4 h-4 text-[var(--accent)]" />
        <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">
          Email
        </label>
      </div>

      <p className="text-sm text-[var(--text-primary)] mb-3">{email}</p>

      {isVerified ? (
        <div className="flex items-center gap-2 text-sm text-[var(--success)]">
          <CheckCircle className="w-4 h-4" />
          <span className="font-medium">Email verificata</span>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-3 text-sm text-[var(--warning)]">
            <AlertTriangle className="w-4 h-4" />
            <span className="font-medium">Email non verificata</span>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleResend}
            disabled={loading || sent}
          >
            {loading
              ? "Invio in corso..."
              : sent
                ? "Inviata!"
                : "Reinvia email di verifica"}
          </Button>

          {error && (
            <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
