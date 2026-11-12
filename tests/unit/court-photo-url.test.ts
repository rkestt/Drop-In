import { afterEach, describe, expect, it } from "vitest";
import { courtPhotoPublicUrl } from "@/lib/storage/court-photos";

const ENV_KEY = "NEXT_PUBLIC_SUPABASE_URL";
const original = process.env[ENV_KEY];

afterEach(() => {
  if (original === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = original;
});

describe("courtPhotoPublicUrl", () => {
  it("costruisce l'URL pubblico del bucket da photo_path", () => {
    process.env[ENV_KEY] = "http://127.0.0.1:54321";
    expect(courtPhotoPublicUrl("user/photo.jpg")).toBe(
      "http://127.0.0.1:54321/storage/v1/object/public/court-photos/user/photo.jpg"
    );
  });

  it("toglie lo slash finale della base (niente doppio slash)", () => {
    process.env[ENV_KEY] = "http://localhost:3100/supabase/";
    expect(courtPhotoPublicUrl("a.jpg")).toBe(
      "http://localhost:3100/supabase/storage/v1/object/public/court-photos/a.jpg"
    );
  });

  it("path con spazi, # e ? -> encodato per segmento, URL intatto", () => {
    process.env[ENV_KEY] = "http://127.0.0.1:54321";
    expect(courtPhotoPublicUrl("uid/foto mia #1.jpg")).toBe(
      "http://127.0.0.1:54321/storage/v1/object/public/court-photos/uid/foto%20mia%20%231.jpg"
    );
    expect(courtPhotoPublicUrl("uid/che?foto.jpg")).toBe(
      "http://127.0.0.1:54321/storage/v1/object/public/court-photos/uid/che%3Ffoto.jpg"
    );
  });

  it("path con / iniziale -> niente doppio slash", () => {
    process.env[ENV_KEY] = "http://127.0.0.1:54321";
    expect(courtPhotoPublicUrl("/uid/a.jpg")).toBe(
      "http://127.0.0.1:54321/storage/v1/object/public/court-photos/uid/a.jpg"
    );
  });

  it("path assente o base vuota -> null (placeholder, mai src vuoto)", () => {
    process.env[ENV_KEY] = "http://127.0.0.1:54321";
    expect(courtPhotoPublicUrl(null)).toBeNull();
    expect(courtPhotoPublicUrl(undefined)).toBeNull();
    expect(courtPhotoPublicUrl("")).toBeNull();
    process.env[ENV_KEY] = "";
    expect(courtPhotoPublicUrl("a.jpg")).toBeNull();
  });
});
