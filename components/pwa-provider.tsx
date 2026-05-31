"use client";

import { useEffect, useState, type ReactNode } from "react";
import { SerwistProvider } from "@serwist/next/react";

export function PwaProvider({ children }: { children: ReactNode }) {
  const [isProd, setIsProd] = useState(false);

  useEffect(() => {
    setIsProd(window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1");
  }, []);

  return isProd ? (
    <SerwistProvider swUrl="/sw.js">{children}</SerwistProvider>
  ) : (
    <>{children}</>
  );
}
