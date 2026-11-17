"use client";

import { useState } from "react";
import { CreateLobbyDrawer } from "@/components/lobby/create-lobby-drawer";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function CreateLobbyButton({
  courtId,
  courtName,
  courtSport = null,
}: {
  courtId: string;
  courtName: string;
  /** Sport del Campo: preseleziona quello della Lobby quando è univoco (#96). */
  courtSport?: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4 me-1.5" />
        Crea lobby
      </Button>
      <CreateLobbyDrawer
        key={courtId}
        courtId={courtId}
        courtName={courtName}
        courtSport={courtSport}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
