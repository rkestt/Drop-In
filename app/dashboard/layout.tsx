import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-40 bg-[var(--bg-elevated)] border-b border-[var(--cool-muted)]/20 pt-safe">
        <div className="max-w-[720px] mx-auto flex items-center h-14 px-4">
          <Link
            href="/"
            className="flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
            <span className="text-sm font-medium">Indietro</span>
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
