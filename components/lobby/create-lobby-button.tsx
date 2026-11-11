"use client";

import { useState } from "react";
import { CreateLobbyDrawer } from "@/components/lobby/create-lobby-drawer";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function CreateLobbyButton({
  courtId,
  courtName,
}: {
  courtId: string;
  courtName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4 me-1.5" />
        Crea lobby
      </Button>
      <CreateLobbyDrawer
        courtId={courtId}
        courtName={courtName}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
