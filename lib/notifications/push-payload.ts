// Payload mostrato dal service worker all'arrivo di una push.
// Puro (nessun DOM). L'URL non e' calcolato qui: alla pressione il
// service worker lo deriva da `data` con `notificationHref`
// (lib/notifications/link), cosi' esiste una sola implementazione della
// regola href. Il `tag` e' l'id della notifica: evita doppioni visivi per
// la stessa riga.

export interface PushPayload {
  title: string;
  body: string;
  data: Record<string, unknown>;
  tag: string;
}

/** Sottoinsieme di riga che basta al payload (il resto arriva dal DB).
 * Titolo/corpo/data sono `unknown`: in arrivo dal wire possono mancare o
 * essere malformati, e la funzione li valida. */
export interface PushPayloadInput {
  id: string;
  title: unknown;
  body: unknown;
  data: unknown;
}

/**
 * Da riga `push_notifications` a payload di notifica, con fallback sobri
 * quando titolo/corpo mancano o `data` non e' un oggetto.
 */
export function pushPayloadFromNotification(
  row: PushPayloadInput,
): PushPayload {
  const title =
    typeof row.title === "string" && row.title.trim() !== ""
      ? row.title
      : "Drop-In";
  const body =
    typeof row.body === "string" && row.body.trim() !== ""
      ? row.body
      : "Hai un nuovo avviso.";
  const data =
    typeof row.data === "object" && row.data !== null && !Array.isArray(row.data)
      ? (row.data as Record<string, unknown>)
      : {};
  return { title, body, data, tag: row.id };
}
