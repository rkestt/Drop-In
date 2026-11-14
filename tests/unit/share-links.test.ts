import { describe, expect, it, afterEach } from "vitest";
import {
  DEFAULT_SITE_URL,
  clipboardText,
  courtPath,
  courtShareContent,
  lobbyPath,
  lobbyShareContent,
  shareUrl,
  siteBaseUrl,
} from "@/lib/share/links";

const ENV_KEY = "NEXT_PUBLIC_SITE_URL";
const original = process.env[ENV_KEY];

afterEach(() => {
  if (original === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = original;
});

describe("siteBaseUrl", () => {
  it("usa l'esplicita quando presente (client: origin)", () => {
    process.env[ENV_KEY] = "https://drop-in.example";
    expect(siteBaseUrl("https://app.example")).toBe("https://app.example");
  });

  it("cade sull'env e poi sul fallback locale", () => {
    process.env[ENV_KEY] = "https://drop-in.example/";
    expect(siteBaseUrl()).toBe("https://drop-in.example");
    delete process.env[ENV_KEY];
    expect(siteBaseUrl()).toBe(DEFAULT_SITE_URL);
    expect(DEFAULT_SITE_URL).toBe("http://localhost:3000");
  });

  it("env vuota o spazi -> fallback, mai stringa vuota", () => {
    process.env[ENV_KEY] = "   ";
    expect(siteBaseUrl()).toBe(DEFAULT_SITE_URL);
  });
});

describe("path e url", () => {
  it("courtPath / lobbyPath sono i deep link relativi", () => {
    expect(courtPath("abc")).toBe("/courts/abc");
    expect(lobbyPath("abc")).toBe("/lobbies/abc");
  });

  it("shareUrl assolutizza il path con la base", () => {
    expect(shareUrl("/courts/abc", "https://app.example")).toBe(
      "https://app.example/courts/abc",
    );
  });

  it("shareUrl tollera il path senza slash iniziale", () => {
    expect(shareUrl("lobbies/abc", "https://app.example")).toBe(
      "https://app.example/lobbies/abc",
    );
  });
});

describe("contenuti di condivisione", () => {
  it("campo: titolo con nome, testo invito in italiano", () => {
    const c = courtShareContent("Parco Sempione");
    expect(c.title).toBe("Parco Sempione · Drop-In");
    expect(c.text).toContain("Parco Sempione");
    expect(c.text).toContain("Drop-In");
  });

  it("lobby: titolo Lobby + nome, testo con data/ora", () => {
    const c = lobbyShareContent("Parco Sempione", "16 nov, 19:40");
    expect(c.title).toBe("Lobby · Parco Sempione");
    expect(c.text).toContain("Parco Sempione");
    expect(c.text).toContain("16 nov, 19:40");
  });
});

describe("clipboardText", () => {
  it("testo + url su due righe", () => {
    expect(
      clipboardText({ text: "Vieni?", url: "https://app.example/courts/1" }),
    ).toBe("Vieni?\nhttps://app.example/courts/1");
  });
});
