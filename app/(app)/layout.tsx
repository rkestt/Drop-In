"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin, User } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const onMap = pathname === "/";
  const onProfile = pathname === "/profile" || pathname.startsWith("/profile/");

  return (
    <div className="flex flex-col min-h-full">
      {children}
      <nav className="sticky bottom-0 bg-[var(--bg-elevated)] border-t border-[var(--cool-muted)]/20 pb-safe" aria-label="Navigazione principale">
        <div className="max-w-[720px] mx-auto flex items-center justify-around h-14">
          <Link
            href="/"
            aria-label="Mappa campi"
            aria-current={onMap ? "page" : undefined}
            className={cn(
              "flex flex-col items-center justify-center w-16 h-14 min-h-[48px]",
              onMap ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
            )}
          >
            <MapPin className="w-6 h-6" aria-hidden="true" />
            <span className="text-label font-medium mt-0.5">Mappa</span>
          </Link>
          <Link
            href="/profile"
            aria-label="Profilo utente"
            aria-current={onProfile ? "page" : undefined}
            className={cn(
              "flex flex-col items-center justify-center w-16 h-14 min-h-[48px]",
              onProfile ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
            )}
          >
            <User className="w-6 h-6" aria-hidden="true" />
            <span className="text-label font-medium mt-0.5">Profilo</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
