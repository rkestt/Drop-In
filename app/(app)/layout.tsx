"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { ProfileButton } from "@/components/ui/profile-button";
import { LoginModal } from "@/components/auth/login-modal";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <div className="flex flex-col min-h-full">
      {children}
      <nav className="sticky bottom-0 bg-[var(--bg-elevated)] border-t border-[var(--cool-muted)]/20 pb-safe" aria-label="Navigazione principale">
        <div className="max-w-[720px] mx-auto flex items-center justify-around h-14">
          <Link
            href="/"
            className="flex flex-col items-center justify-center w-16 h-14 min-h-[48px] text-[var(--accent)]"
            aria-label="Mappa campi"
          >
            <MapPin className="w-6 h-6" aria-hidden="true" />
            <span className="text-[10px] font-medium mt-0.5">Mappa</span>
          </Link>
          <ProfileButton onLoginRequest={() => setShowLogin(true)} />
        </div>
      </nav>
      <LoginModal open={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
