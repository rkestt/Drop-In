"use client";

import { createClient } from "@/lib/supabase/client";
import { resizeImageToJpeg } from "./resize";

export { computeTargetSize } from "./resize";
// Parte pura e server-safe (generateMetadata): vive in un modulo senza
// direttiva, qui solo ri-esportata per non rompere gli import esistenti.
export {
  COURT_PHOTOS_BUCKET,
  courtPhotoPublicUrl,
} from "./court-photo-url";

const MAX_DIMENSION = 1600;
const BUCKET_NAME = "court-photos";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

type SupabaseClient = ReturnType<typeof createClient>;

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
    const resized = await resizeImageToJpeg(file, MAX_DIMENSION);
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
