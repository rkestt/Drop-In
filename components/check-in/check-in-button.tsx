"use client";

import { useState } from "react";
import {
  CheckInSheet,
  type ActiveCheckIn,
} from "@/components/check-in/check-in-sheet";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";

export function CheckInButton({
  courtId,
  courtName,
  courtLat,
  courtLng,
  activeCheckIn = null,
  mockGps = false,
}: {
  courtId: string;
  courtName: string;
  courtLat: number;
  courtLng: number;
  activeCheckIn?: ActiveCheckIn | null;
  mockGps?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <MapPin className="me-1.5 h-4 w-4" aria-hidden="true" />
        {activeCheckIn ? "Sei qui" : "Check-in"}
      </Button>
      <CheckInSheet
        courtId={courtId}
        courtName={courtName}
        courtLat={courtLat}
        courtLng={courtLng}
        activeCheckIn={activeCheckIn}
        mockGps={mockGps}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
