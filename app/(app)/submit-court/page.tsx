"use client";

import { useState } from "react";
import { SubmitCourtForm } from "@/components/court/submit-court-form";
import { LoginModal } from "@/components/auth/login-modal";
import { MapPin } from "lucide-react";

export default function SubmitCourtPage() {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <main className="flex-1 bg-[var(--bg-base)]">
      <div className="max-w-[720px] mx-auto px-4 py-6 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--accent-subtle)] text-[var(--accent)]">
            <MapPin className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-[family-name:var(--font-syne)] text-[var(--text-primary)]">
              Aggiungi un campo
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Aiuta la community segnalando un campo mancante.
            </p>
          </div>
        </div>

        <SubmitCourtForm onLoginRequired={() => setShowLogin(true)} />
      </div>

      <LoginModal open={showLogin} onClose={() => setShowLogin(false)} />
    </main>
  );
}
