"use client";

import { createClient } from "@/lib/supabase/client";
import { supabaseUrl } from "@/lib/supabase/url";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;
const BUCKET_NAME = "court-photos";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const DECODE_TIMEOUT_MS = 20_000;

type SupabaseClient = ReturnType<typeof createClient>;

/**
 * URL pubblico di una foto campo da `courts.photo_path`, nello stesso formato
 * di `storage.from(BUCKET_NAME).getPublicUrl(path)` ma senza istanziare un
 * client per ogni card di lista. In dev `supabaseUrl()` risolve il proxy
 * `/supabase`; path assente o base non configurata → null (il chiamante
 * mostra il placeholder, mai un `src` vuoto).
 */
export function courtPhotoPublicUrl(
  path: string | null | undefined
): string | null {
  if (!path) return null;
  const base = supabaseUrl().replace(/\/$/, "");
  if (!base) return null;
  return `${base}/storage/v1/object/public/${BUCKET_NAME}/${path}`;
}

function extensionFromMime(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

function mimeFromExtension(ext: string): string {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

/**
 * Calcolo puro del target di ridimensionamento: il lato lungo scende a
 * `maxDim`, l'altro scala in proporzione. Le immagini già entro il limite
 * restano invariate (niente upscale).
 */
export function computeTargetSize(
  srcWidth: number,
  srcHeight: number,
  maxDim: number = MAX_DIMENSION
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
  height: number
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

    ctx.drawImage(source, 0, 0, width, height);

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
function resizeViaImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
    };

    image.onload = () => {
      const target = computeTargetSize(image.width, image.height);
      canvasToJpeg(image, target.width, target.height).then(
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
 * sulla sonda è essenziale: senza, `computeTargetSize` sceglierebbe il lato
 * sbagliato per le foto ruotate via EXIF.
 *
 * Il bitmap della sonda riusato quando l'immagine è già entro il limite
 * (un solo decode); i bitmap vengono sempre chiusi (`close()`), anche nei
 * rami di errore, per non tenere in memoria decine di megapixel.
 */
async function resizeViaBitmap(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  let probe: ImageBitmap | null = null;
  let final: ImageBitmap | null = null;
  try {
    probe = await createImageBitmap(file, { imageOrientation: "from-image" });
    const target = computeTargetSize(probe.width, probe.height);

    if (target.width === probe.width && target.height === probe.height) {
      final = probe;
      probe = null;
      return await canvasToJpeg(final, target.width, target.height);
    }

    const resizeOptions: ImageBitmapOptions = {
      imageOrientation: "from-image",
      resizeQuality: "high",
    };
    if (probe.width >= probe.height) {
      resizeOptions.resizeWidth = target.width;
    } else {
      resizeOptions.resizeHeight = target.height;
    }

    try {
      final = await createImageBitmap(file, resizeOptions);
    } catch {
      // Resize nativo non supportato: riusa la sonda, scala il canvas.
      final = probe;
      probe = null;
    }
    return await canvasToJpeg(final, target.width, target.height);
  } finally {
    probe?.close();
    final?.close();
  }
}

function resizeImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const work = (async () => {
    if (typeof createImageBitmap === "function") {
      try {
        return await resizeViaBitmap(file);
      } catch {
        // Ricade sul percorso storico qui sotto.
      }
    }
    return await resizeViaImage(file);
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

export interface UploadResult {
  path: string;
  publicUrl: string;
  size: number;
}

export async function uploadCourtPhoto(
  supabase: SupabaseClient,
  file: File
): Promise<UploadResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Devi effettuare l'accesso per caricare una foto.");
  }

  let blob: Blob;
  let ext: string;

  try {
    const resized = await resizeImage(file);
    blob = resized.blob;
    ext = "jpg";
  } catch {
    // `file.type` può essere vuoto su alcuni Android (foto scattata al
    // momento): non è un rifiuto, il contenuto verrà comunque ricodificato
    // in JPEG dal percorso resize quando decodificabile.
    if (
      file.type !== "" &&
      file.type !== "image/jpeg" &&
      file.type !== "image/png" &&
      file.type !== "image/webp"
    ) {
      throw new Error("Formato non supportato: scegli una foto JPEG o PNG");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error(
        "Il formato della foto non è supportato e il file originale supera i 5 MB."
      );
    }
    blob = file;
    ext = extensionFromMime(file.type);
  }

  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const contentType = mimeFromExtension(ext);

  const { error } = await supabase.storage.from(BUCKET_NAME).upload(path, blob, {
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);

  return {
    path,
    publicUrl: data.publicUrl,
    size: blob.size,
  };
}

export async function deleteCourtPhoto(
  supabase: SupabaseClient,
  path: string
): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET_NAME).remove([path]);
  if (error) {
    console.error("Failed to delete orphan court photo:", error.message);
  }
}
