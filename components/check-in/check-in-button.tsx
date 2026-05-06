"use client";

import { useState } from "react";
import { CheckInSheet } from "@/components/check-in/check-in-sheet";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";

export function CheckInButton({
  courtId,
  courtName,
  courtLat,
  courtLng,
}: {
  courtId: string;
  courtName: string;
  courtLat: number;
  courtLng: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <MapPin className="w-4 h-4 mr-1.5" />
        Check-in
      </Button>
      <CheckInSheet
        courtId={courtId}
        courtName={courtName}
        courtLat={courtLat}
        courtLng={courtLng}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
