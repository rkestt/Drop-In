"use client";
import { useEffect } from "react";
import { createLogger } from "@/lib/logger";
const log = createLogger("global-error");
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { try { log.error(error); } catch {} }, [error]);
  return (
    <html lang="it">
      <body style={{ margin:0, minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, padding:24, textAlign:"center", fontFamily:"system-ui,sans-serif" }}>
        <h2 style={{ fontSize:"1.125rem", fontWeight:600 }}>Errore critico</h2>
        <p style={{ fontSize:"0.875rem", color:"#555" }}>Riprova o ricarica la pagina.</p>
        <button onClick={reset} style={{ padding:"8px 16px", borderRadius:8, border:"none", background:"#0d1117", color:"#fff", cursor:"pointer" }}>Riprova</button>
      </body>
    </html>
  );
}
