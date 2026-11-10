"use client";

// d24, stato 08 del prototipo (errore critico): volutamente fuori dai token.
// Solo colori e font di sistema: questa pagina deve leggersi anche se il CSS
// e i font dell'app non sono disponibili. Nessun import dall'app.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="it">
      <body style={{ margin: 0, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, background: "Canvas", color: "CanvasText", colorScheme: "dark", fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}>
        <div role="alert" style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 12, width: "100%", maxWidth: 420 }}>
          <p style={{ margin: 0, color: "GrayText", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" }}>Drop-In</p>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, lineHeight: 1.2 }}>Qualcosa si è rotto.</h1>
          <p style={{ margin: 0, color: "GrayText", fontSize: 15, lineHeight: 1.5 }}>Drop-In non è riuscito ad avviarsi. Ricarica la pagina; se succede ancora, riapri l&apos;app tra qualche minuto.</p>
          <button onClick={reset} style={{ width: "100%", minHeight: 48, marginTop: 8, border: 0, borderRadius: 10, background: "ButtonText", color: "ButtonFace", font: "inherit", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>Riprova</button>
          {/* global-error: niente router context, <a> è l'unica via */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" style={{ display: "block", textAlign: "center", minHeight: 44, lineHeight: "44px", color: "LinkText", fontSize: 15 }}>Torna alla mappa</a>
          {error.digest && (
            <p style={{ margin: "8px 0 0", color: "GrayText", fontSize: 12 }}>Errore critico · riferimento {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}
