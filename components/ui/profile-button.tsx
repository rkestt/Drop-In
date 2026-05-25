"use client";

import Link from "next/link";
import { User } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";

interface ProfileButtonProps {
  onLoginRequest: () => void;
}

export function ProfileButton({ onLoginRequest }: ProfileButtonProps) {
  const { user } = useAuth();

  if (user) {
    return (
      <Link
        href="/dashboard/profile"
        className="flex flex-col items-center justify-center w-16 h-14 min-h-[48px] text-[var(--text-muted)]"
        aria-label="Profilo utente"
      >
        <User className="w-6 h-6" aria-hidden="true" />
        <span className="text-[10px] font-medium mt-0.5">Profilo</span>
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onLoginRequest}
      className="flex flex-col items-center justify-center w-16 h-14 min-h-[48px] text-[var(--text-muted)]"
      aria-label="Accedi o registrati"
    >
      <User className="w-6 h-6" aria-hidden="true" />
      <span className="text-[10px] font-medium mt-0.5">Profilo</span>
    </button>
  );
}
