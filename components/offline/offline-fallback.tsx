"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface OfflineFallbackProps {
  children: React.ReactNode;
}

export function OfflineFallback({ children }: OfflineFallbackProps) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-[var(--warning)]" />
        <p className="text-[var(--text-secondary)]">
          Sei offline. Alcune funzioni non sono disponibili.
        </p>
        <Button
          variant="secondary"
          onClick={() => window.location.reload()}
        >
          Riprova
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
