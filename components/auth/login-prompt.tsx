"use client";

import { useState } from "react";
import { LoginModal } from "@/components/auth/login-modal";
import { Button } from "@/components/ui/button";

export function LoginPrompt() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="w-full bg-[var(--bg-surface)] rounded-xl p-4 text-center">
        <p className="text-[var(--text-secondary)] text-sm mb-3">
          Accedi per fare check-in, creare lobby o inviare segnalazioni.
        </p>
        <Button onClick={() => setOpen(true)}>Accedi</Button>
      </div>
      <LoginModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
