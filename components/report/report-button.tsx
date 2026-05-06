"use client";

import { useState } from "react";
import { ReportSheet } from "@/components/report/report-sheet";
import { Button } from "@/components/ui/button";
import { Flag } from "lucide-react";

export function ReportButton({
  courtId,
  courtName,
}: {
  courtId: string;
  courtName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <Flag className="w-4 h-4 mr-1.5" />
        Segnala
      </Button>
      <ReportSheet
        courtId={courtId}
        courtName={courtName}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
