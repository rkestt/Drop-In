"use client";

/**
 * Motore di ridimensionamento client condiviso (court-photos + avatars).
 *
 * Il piano free non ha trasformazioni lato server, quindi il resize avviene qui
 * prima dell'upload: decodifica via `createImageBitmap` con `from-image` (EXIF
 * applicato) e secondo passaggio nativo quando serve ridurre, con fallback su
 * `Image` + object URL. Spostato qui da `court-photos.ts` senza cambi di
 * comportamento: `resizeImageToJpeg(file, 1600)` e' il vecchio `resizeImage`.
 */

const JPEG_QUALITY = 0.8;
const DECODE_TIMEOUT_MS = 20_000;

export interface CropRect {
  sx: number;
  sy: number;
  size: number;
}

interface ResizePlan {
  width: number;
  height: number;
  /** Assente = scala intera; presente = ritaglia prima di scalare. */
  crop?: CropRect;
}

/**
 * Calcolo puro del target di ridimensionamento: il lato lungo scende a
 * `maxDim`, l'altro scala in proporzione. Le immagini già entro il limite
 * restano invariate (niente upscale).
 */
export function computeTargetSize(
  srcWidth: number,
  srcHeight: number,
  maxDim: number = 1600
): { width: number; height: number } {
  if (srcWidth > srcHeight && srcWidth > maxDim) {
    return { width: maxDim, height: Math.round((srcHeight * maxDim) / srcWidth) };
  }
  if (srcHeight >= srcWidth && srcHeight > maxDim) {
    return { width: Math.round((srcWidth * maxDim) / srcHeight), height: maxDim };
  }
  return { width: srcWidth, height: srcHeight };
}

function canvasToJpeg(
  source: CanvasImageSource,
  width: number,
  height: number,
  crop?: CropRect
): Promise<{ blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Canvas non supportato dal browser"));
      return;
    }

    if (crop) {
      ctx.drawImage(source, crop.sx, crop.sy, crop.size, crop.size, 0, 0, width, height);
    } else {
      ctx.drawImage(source, 0, 0, width, height);
    }

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Conversione immagine fallita"));
          return;
        }
        resolve({ blob, width, height });
      },
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}

/**
 * Percorso storico: decodifica via `Image` + object URL, poi scala su canvas.
 * Su Android con foto da 12-50 MP è il punto fragile (allocazione del
 * bitmap a piena risoluzione, EXIF non applicato), quindi resta solo come
 * fallback quando `createImageBitmap` manca o fallisce.
 */
function resizeViaImage(
  file: File,
  planFor: (w: number, h: number) => ResizePlan
): Promise<{ blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
    };

    image.onload = () => {
      const plan = planFor(image.width, image.height);
      canvasToJpeg(image, plan.width, plan.height, plan.crop).then(
        (result) => {
          cleanup();
          resolve(result);
        },
        (err) => {
          cleanup();
          reject(err instanceof Error ? err : new Error("Conversione immagine fallita"));
        }
      );
    };

    image.onerror = () => {
      cleanup();
      reject(new Error("Impossibile decodificare l'immagine"));
    };

    image.src = objectUrl;
  });
}

/**
 * Percorso preferito su browser moderni (incluso Chrome Android).
 *
 * Scelta di implementazione: due passaggi. Prima una decodifica "sonda" con
 * `imageOrientation: "from-image"` per conoscere le dimensioni GIÀ ruotate
 * secondo l'EXIF (una foto 4000x3000 scattata in verticale arriva come
 * 3000x4000), poi — solo se serve ridurre — una seconda decodifica con
 * `resizeWidth`/`resizeHeight` così il ridimensionamento avviene nel
 * decodificatore invece che su un canvas a piena risoluzione. `from-image`
 * sulla sonda è essenziale: senza, il target sceglierebbe il lato sbagliato
 * per le foto ruotate via EXIF.
 *
 * Il bitmap della sonda riusato quando l'immagine è già entro il limite
 * (un solo decode); i bitmap vengono sempre chiusi (`close()`), anche nei
 * rami di errore, per non tenere in memoria decine di megapixel.
 *
 * Con `crop` (avatar quadrati) il secondo passaggio nativo è disattivato di
 * proposito: le coordinate di ritaglio sono nello spazio già ruotato della
 * sonda, mentre il decodificatore applicherebbe `from-image` dopo il ritaglio
 * — la regione sarebbe sbagliata nelle foto ruotate via EXIF. Il crop avviene
 * quindi sempre sul bitmap della sonda, già orientato correttamente.
 */
async function resizeViaBitmap(
  file: File,
  planFor: (w: number, h: number) => ResizePlan
): Promise<{ blob: Blob; width: number; height: number }> {
  let probe: ImageBitmap | null = null;
  let final: ImageBitmap | null = null;
  try {
    probe = await createImageBitmap(file, { imageOrientation: "from-image" });
    const plan = planFor(probe.width, probe.height);

    if (
      !plan.crop &&
      plan.width === probe.width &&
      plan.height === probe.height
    ) {
      final = probe;
      probe = null;
      return await canvasToJpeg(final, plan.width, plan.height);
    }

    if (plan.crop) {
      // Crop sul bitmap orientato, poi scala su canvas.
      final = probe;
      probe = null;
      return await canvasToJpeg(final, plan.width, plan.height, plan.crop);
    }

    const resizeOptions: ImageBitmapOptions = {
      imageOrientation: "from-image",
      resizeQuality: "high",
    };
    if (probe.width >= probe.height) {
      resizeOptions.resizeWidth = plan.width;
    } else {
      resizeOptions.resizeHeight = plan.height;
    }

    try {
      final = await createImageBitmap(file, resizeOptions);
    } catch {
      // Resize nativo non supportato: riusa la sonda, scala il canvas.
      final = probe;
      probe = null;
    }
    return await canvasToJpeg(final, plan.width, plan.height);
  } finally {
    probe?.close();
    final?.close();
  }
}

function resizeWithPlan(
  file: File,
  planFor: (w: number, h: number) => ResizePlan
): Promise<{ blob: Blob; width: number; height: number }> {
  const work = (async () => {
    if (typeof createImageBitmap === "function") {
      try {
        return await resizeViaBitmap(file, planFor);
      } catch {
        // Ricade sul percorso storico qui sotto.
      }
    }
    return await resizeViaImage(file, planFor);
  })();

  // Senza timeout il promise resterebbe appeso (pulsante che gira all'infinito).
  // Promise.race gestisce il rejection tardivo di `work`, quindi nessun
  // "unhandled rejection" se la decodifica fallisce dopo lo scadere.
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error("La foto è troppo grande o il formato non è leggibile da questo browser"));
    }, DECODE_TIMEOUT_MS);
  });

  return Promise.race([work, timeout]);
}

/**
 * Ridimensiona preservando l'aspect ratio (foto campi): il lato lungo scende a
 * `maxDim`. Era `resizeImage` in `court-photos.ts`, comportamento identico.
 */
export function resizeImageToJpeg(
  file: File,
  maxDim: number
): Promise<{ blob: Blob; width: number; height: number }> {
  return resizeWithPlan(file, (w, h) => {
    const target = computeTargetSize(w, h, maxDim);
    return { width: target.width, height: target.height };
  });
}

/**
 * Ridimensiona con crop quadrato (avatar): `crop` calcola la regione nello
 * spazio già orientato, poi scala al quadrato `min(crop.size, maxDim)`
 * (niente upscale per le immagini già piccole).
 */
export function resizeSquareImageToJpeg(
  file: File,
  maxDim: number,
  crop: (w: number, h: number) => CropRect
): Promise<{ blob: Blob; width: number; height: number }> {
  return resizeWithPlan(file, (w, h) => {
    const rect = crop(w, h);
    const side = Math.min(rect.size, maxDim);
    return { width: side, height: side, crop: rect };
  });
}
