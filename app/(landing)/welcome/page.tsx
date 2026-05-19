"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ChevronRight, MapPin } from "lucide-react";

export default function WelcomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const seen = localStorage.getItem("welcome_seen");
    if (seen) {
      router.replace("/");
      return;
    }

    setTimeout(() => setIsLoading(false), 2000);
  }, [router]);

  const handleEnter = () => {
    localStorage.setItem("welcome_seen", "true");
    router.replace("/");
  };

  const handleSkip = () => {
    localStorage.setItem("welcome_seen", "true");
    router.replace("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex flex-col items-center justify-center p-6">
        <div className="w-28 h-28 relative mb-6">
          <Image
            src="/images/dropin.png"
            alt="Drop-In"
            fill
            className="object-contain"
            priority
          />
        </div>
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full bg-[var(--accent)] animate-pulse"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-4">
          Caricamento...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex flex-col">
      {/* Skip button */}
      <div className="flex justify-end p-4">
        <button
          onClick={handleSkip}
          className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          aria-label="Salta"
        >
          Salta
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        {/* Logo */}
        <div className="w-40 h-40 relative mb-8">
          <Image
            src="/images/dropin.png"
            alt="Drop-In"
            fill
            className="object-contain"
            priority
          />
        </div>

        {/* Description */}
        <div className="text-center max-w-xs mb-8">
          <p className="text-[var(--text-secondary)] text-base leading-relaxed">
            Trova campetti sportivi nella tua zona, crea o unisciti alle partite.
          </p>
        </div>

        {/* Loading dots */}
        <div className="flex items-center gap-2 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-[var(--accent)]/60 animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>

        {/* Enter button */}
        <Button
          onClick={handleEnter}
          className="w-full max-w-xs"
        >
          Entra nell&apos;app
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>

        
      </div>

      {/* Features preview */}
      <div className="p-6 border-t border-[var(--cool-muted)]/20">
        <div className="flex justify-center gap-8">
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center">
              <MapPin className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <span className="text-xs text-[var(--text-muted)]">Trova campi</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center">
              <svg className="w-5 h-5 text-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <span className="text-xs text-[var(--text-muted)]">Unisciti</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center">
              <svg className="w-5 h-5 text-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <span className="text-xs text-[var(--text-muted)]">Gioca</span>
          </div>
        </div>
      </div>
    </div>
  );
}