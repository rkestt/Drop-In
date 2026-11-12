import { describe, expect, it, vi } from "vitest";
import {
  AVATAR_MAX_DIM,
  avatarObjectPath,
  avatarPublicUrl,
  computeAvatarCrop,
  uploadAvatar,
} from "@/lib/storage/avatars";

vi.mock("@/lib/storage/resize", () => ({
  resizeSquareImageToJpeg: vi.fn(
    async () => ({ blob: new Blob(["x"]), width: 512, height: 512 })
  ),
}));

const ENV_KEY = "NEXT_PUBLIC_SUPABASE_URL";
const original = process.env[ENV_KEY];

describe("computeAvatarCrop", () => {
  it("landscape: ritaglia al centro sul lato corto", () => {
    expect(computeAvatarCrop(4000, 3000)).toEqual({ sx: 500, sy: 0, size: 3000 });
  });

  it("portrait: ritaglia al centro sul lato corto", () => {
    expect(computeAvatarCrop(3000, 4000)).toEqual({ sx: 0, sy: 500, size: 3000 });
  });

  it("quadrato: nessun offset", () => {
    expect(computeAvatarCrop(800, 800)).toEqual({ sx: 0, sy: 0, size: 800 });
  });

  it("gia' piccolo: niente upscale implicito (lato < AVATAR_MAX_DIM)", () => {
    const crop = computeAvatarCrop(200, 100);
    expect(crop).toEqual({ sx: 50, sy: 0, size: 100 });
    expect(crop.size).toBeLessThan(AVATAR_MAX_DIM);
  });
});

describe("avatarObjectPath", () => {
  const base = "https://ref.supabase.co/storage/v1/object/public/avatars";

  it("URL assoluto -> path oggetto", () => {
    expect(avatarObjectPath(`${base}/uid/foto.jpg`)).toBe("uid/foto.jpg");
  });

  it("bare path -> invariato (senza slash iniziali)", () => {
    expect(avatarObjectPath("uid/foto.jpg")).toBe("uid/foto.jpg");
    expect(avatarObjectPath("/uid/foto.jpg")).toBe("uid/foto.jpg");
  });

  it("assente o vuoto -> null", () => {
    expect(avatarObjectPath(null)).toBeNull();
    expect(avatarObjectPath(undefined)).toBeNull();
    expect(avatarObjectPath("")).toBeNull();
  });

  it("URL straniero (altro bucket o altro host) -> null, mai cancellato", () => {
    expect(
      avatarObjectPath("https://ref.supabase.co/storage/v1/object/public/court-photos/uid/a.jpg")
    ).toBeNull();
    expect(avatarObjectPath("https://evil.example/x.jpg")).toBeNull();
  });
});

describe("avatarPublicUrl", () => {
  it("URL assoluto -> invariato", () => {
    process.env[ENV_KEY] = "http://127.0.0.1:54321";
    const absolute = "https://ref.supabase.co/storage/v1/object/public/avatars/uid/a.jpg";
    expect(avatarPublicUrl(absolute)).toBe(absolute);
    if (original === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = original;
  });

  it("bare path -> URL pubblico costruito come getPublicUrl", () => {
    process.env[ENV_KEY] = "http://127.0.0.1:54321";
    try {
      expect(avatarPublicUrl("uid/foto.jpg")).toBe(
        "http://127.0.0.1:54321/storage/v1/object/public/avatars/uid/foto.jpg"
      );
    } finally {
      if (original === undefined) delete process.env[ENV_KEY];
      else process.env[ENV_KEY] = original;
    }
  });

  // In dev la base pubblica è relativa (`/supabase`): il `src` renderizzato
  // dal server deve restare same-origin, non assolutizzarsi a 127.0.0.1
  // (supabaseUrl() lo fa per supabase-js, ma qui romperebbe il caricamento
  // dell'immagine da un telefono sulla LAN).
  it("base relativa -> src same-origin", () => {
    process.env[ENV_KEY] = "/supabase";
    try {
      expect(avatarPublicUrl("uid/foto.jpg")).toBe(
        "/supabase/storage/v1/object/public/avatars/uid/foto.jpg"
      );
    } finally {
      if (original === undefined) delete process.env[ENV_KEY];
      else process.env[ENV_KEY] = original;
    }
  });

  it("assente -> null", () => {
    expect(avatarPublicUrl(null)).toBeNull();
  });
});

describe("uploadAvatar", () => {
  it("il path e' isolato per proprietario (<uid>/...) e usa upsert: false, image/jpeg", async () => {
    const uid = "11111111-1111-1111-1111-111111111111";
    const uploaded: { path: string; options: unknown }[] = [];
    const supabase = {
      auth: { getUser: async () => ({ data: { user: { id: uid } } }) },
      storage: {
        from: (bucket: string) => {
          expect(bucket).toBe("avatars");
          return {
            upload: async (path: string, blob: Blob, options: unknown) => {
              uploaded.push({ path, options });
              expect(blob).toBeInstanceOf(Blob);
              return { error: null };
            },
            getPublicUrl: (path: string) => ({
              data: { publicUrl: `https://cdn.example/avatars/${path}` },
            }),
          };
        },
      },
    };

    const result = await uploadAvatar(
      supabase as never,
      new File(["x"], "foto.png", { type: "image/png" })
    );

    expect(uploaded).toHaveLength(1);
    // Regola di isolamento RLS: il primo segmento e' l'uid.
    expect(uploaded[0]!.path.startsWith(`${uid}/`)).toBe(true);
    expect(uploaded[0]!.path.endsWith(".jpg")).toBe(true);
    expect(uploaded[0]!.options).toMatchObject({
      contentType: "image/jpeg",
      upsert: false,
    });
    expect(result.path).toBe(uploaded[0]!.path);
    expect(result.publicUrl).toContain(uploaded[0]!.path);
    expect(result.size).toBeGreaterThan(0);
  });

  it("senza utente -> errore login", async () => {
    const supabase = {
      auth: { getUser: async () => ({ data: { user: null } }) },
      storage: { from: () => ({}) },
    };
    await expect(
      uploadAvatar(supabase as never, new File(["x"], "a.png", { type: "image/png" }))
    ).rejects.toThrow("accesso");
  });
});
