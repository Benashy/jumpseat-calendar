import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const url = new URL("../index.html", import.meta.url);
const html = await readFile(url, "utf8");
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .filter(([tag]) => !/\bsrc=/.test(tag.split(">")[0]))
  .map(([, text]) => `'sha256-${createHash("sha256").update(text).digest("base64")}'`);
const policy = [
  "default-src 'self'", `script-src 'self' ${scripts.join(" ")}`,
  "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
  "font-src 'self'", "connect-src 'self' https://kztwizifuhuvbccyycdm.supabase.co wss://kztwizifuhuvbccyycdm.supabase.co",
  "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-src 'none'", "worker-src 'self'",
].join("; ");
const tag = `    <meta http-equiv="Content-Security-Policy" content="${policy}">`;
const existing = /^\s*<meta http-equiv="Content-Security-Policy"[^>]+>/m;
const next = existing.test(html) ? html.replace(existing, `\n${tag}`) : html.replace(/(<meta charset="utf-8"\s*\/?>)/i, `$1\n${tag}`);
if (process.argv.includes("--check")) {
  if (!html.includes(tag)) throw new Error("Content security policy hashes are stale. Run npm run prepare:release.");
} else await writeFile(url, next);
