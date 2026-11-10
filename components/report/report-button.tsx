"use client";

import { useState } from "react";
import { ReportDrawer, type ReportRow } from "@/components/report/report-drawer";
import { LoginModal } from "@/components/auth/login-modal";
import { Button } from "@/components/ui/button";
import { Flag } from "lucide-react";

interface ReportButtonProps {
  courtId: string;
  courtName: string;
  /** Segnalazioni attive del campo (dal server). */
  reports: ReportRow[];
  currentUserId: string | null;
  signedIn: boolean;
}

export function ReportButton({
  courtId,
  courtName,
  reports,
  currentUserId,
  signedIn,
}: ReportButtonProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  // Gate d'ingresso, non a metà form: senza login il pulsante apre
  // direttamente il login invece del drawer. Resta sempre visibile.
  const handleClick = () => {
    if (signedIn) {
      setDrawerOpen(true);
    } else {
      setLoginOpen(true);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        onClick={handleClick}
        aria-describedby={
          signedIn ? undefined : "report-button-login-hint"
        }
      >
        <Flag className="w-4 h-4 mr-1.5" aria-hidden="true" />
        Segnala
      </Button>
      {!signedIn && (
        <span id="report-button-login-hint" className="sr-only">
          Accedi per segnalare
        </span>
      )}
      {signedIn ? (
        <ReportDrawer
          courtId={courtId}
          courtName={courtName}
          reports={reports}
          currentUserId={currentUserId}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />
      ) : (
        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      )}
    </>
  );
}
