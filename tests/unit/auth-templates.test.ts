import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const TEMPLATE_DIR = path.join(ROOT, "supabase/auth/templates");
const CONFIG = path.join(ROOT, "supabase/config.toml");

const TEMPLATES = {
  confirmation: "confirmation.html",
  recovery: "recovery.html",
  magic_link: "magic-link.html",
  email_change: "email-change.html",
  invite: "invite.html",
} as const;

function readTemplate(file: string): string {
  return fs.readFileSync(path.join(TEMPLATE_DIR, file), "utf8");
}

describe("template email auth (#86)", () => {
  it("esistono tutti i template previsti", () => {
    for (const file of Object.values(TEMPLATES)) {
      expect(fs.existsSync(path.join(TEMPLATE_DIR, file)), file).toBe(true);
    }
  });

  it.each(Object.entries(TEMPLATES))(
    "%s: link, lingua e nessun host cablato",
    (_kind, file) => {
      const html = readTemplate(file);
      expect(html).toContain("{{ .ConfirmationURL }}");
      expect(html).toMatch(/<html lang="it">/);
      expect(html).not.toContain("http://localhost");
      expect(html).not.toContain("http://127.0.0.1");
      // Niente font o immagini remote: i client email le bloccano e
      // finirebbero comunque nel conteggio dei contenuti esterni.
      expect(html).not.toMatch(/<img\b/i);
      expect(html).not.toMatch(/@import|fonts\.googleapis/i);
      // Brand coerente con l'app (tema unico dark, accent verde).
      expect(html).toContain("#24ae56");
      expect(html).toContain("#141414");
    }
  );

  it("email-change cita vecchio e nuovo indirizzo", () => {
    const html = readTemplate(TEMPLATES.email_change);
    expect(html).toContain("{{ .Email }}");
    expect(html).toContain("{{ .NewEmail }}");
  });

  it("config.toml punta ai file e ha un oggetto per ognuno", () => {
    const config = fs.readFileSync(CONFIG, "utf8");
    for (const [kind, file] of Object.entries(TEMPLATES)) {
      const block = new RegExp(
        `\\[auth\\.email\\.template\\.${kind}\\]\\s*\\nsubject = "([^"]+)"\\s*\\ncontent_path = "\\./([^"]+)"`
      ).exec(config);
      expect(block, `blocco [auth.email.template.${kind}] mancante`).not.toBeNull();
      expect(block![1]!.trim().length).toBeGreaterThan(0);
      expect(block![2]).toBe(`supabase/auth/templates/${file}`);
      expect(fs.existsSync(path.join(ROOT, block![2]!))).toBe(true);
    }
  });
});
