"use client";

import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

interface QuickCreateFABProps {
  onClick: () => void;
  className?: string;
}

export function QuickCreateFAB({ onClick, className }: QuickCreateFABProps) {
  return (
    <div className={className}>
      <Button onClick={onClick} className="w-full" size="sm">
        <Zap className="w-4 h-4" />
          Seleziona campo
      </Button>
    </div>
  );
}

interface FABProps {
  onClick: () => void;
  onLongPress?: () => void;
  className?: string;
}

export function FAB(_props: FABProps) {
  return null;
}