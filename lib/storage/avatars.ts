"use client";

import { createClient } from "@/lib/supabase/client";
import { resizeSquareImageToJpeg } from "./resize";
import {
  AVATAR_BUCKET,
  AVATAR_MAX_DIM,
  avatarObjectPath,
  computeAvatarCrop,
} from "./avatar-url";

/**
 * Upload/rimozione avatar (lato client). La parte pura e server-safe
 * (`computeAvatarCrop`, `avatarObjectPath`, `avatarPublicUrl`, costanti) vive
 * in `./avatar-url`: i Server Component possono importarla, mentre questo
 * modulo è un client module e non va importato dal server.
 */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

type SupabaseClient = ReturnType<typeof createClient>;

// Re-export per i chiamanti client e i test esistenti: un solo punto di
// import (`@/lib/storage/avatars`) senza duplicare le regole.
export { AVATAR_MAX_DIM, computeAvatarCrop, avatarObjectPath, avatarPublicUrl } from "./avatar-url";

export interface AvatarUploadResult {
  path: string;
  publicUrl: string;
  size: number;
}

export async function uploadAvatar(
  supabase: SupabaseClient,
  file: File
): Promise<AvatarUploadResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Devi effettuare l'accesso per caricare una foto.");
  }

  let blob: Blob;
  try {
    const resized = await resizeSquareImageToJpeg(
      file,
      AVATAR_MAX_DIM,
      computeAvatarCrop
    );
    blob = resized.blob;
  } catch {
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
    throw new Error("Impossibile leggere l'immagine: scegli una foto JPEG o PNG");
  }

  const path = `${user.id}/${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);

  return {
    path,
    publicUrl: data.publicUrl,
    size: blob.size,
  };
}

export async function deleteAvatar(
  supabase: SupabaseClient,
  pathOrUrl: string | null | undefined
): Promise<void> {
  const path = avatarObjectPath(pathOrUrl);
  if (!path) return;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);
  if (error) {
    console.error("Failed to delete orphan avatar:", error.message);
  }
}
