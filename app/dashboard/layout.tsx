import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full">
      <header className="flex-shrink-0 z-40 bg-[var(--bg-elevated)] border-b border-[var(--cool-muted)]/20 pt-safe">
        <div className="max-w-[720px] mx-auto lg:max-w-[1600px] lg:px-8 flex items-center h-14 px-4">
          <Link
            href="/"
            className="flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
            <span className="text-sm font-medium">Indietro</span>
          </Link>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {children}
      </div>
    </div>
  );
}
