(function attachChecklistBackup(globalScope) {
  "use strict";

  const MAX_PDF_BYTES = 2 * 1024 * 1024;
  const HASH_PATTERN = /^[a-f0-9]{64}$/;
  const KEY_PATTERN = /^[a-z][a-z0-9-]{0,79}$/;
  const FILENAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._()-]{0,158}\.pdf$/i;

  function bytesFromBase64(value, decode) {
    if (typeof value !== "string" || !value.length || value.length > Math.ceil(MAX_PDF_BYTES * 4 / 3) + 8) {
      throw new Error("Invalid PDF data");
    }
    const binary = decode(value.replace(/\s+/g, ""));
    if (!binary.length || binary.length > MAX_PDF_BYTES) throw new Error("Invalid PDF size");
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  function digestHex(buffer) {
    return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function verify(record, expectedKey, expectedContentHash, cryptoApi, decode) {
    if (!record || !KEY_PATTERN.test(expectedKey || "") || !HASH_PATTERN.test(expectedContentHash || "") ||
      record.checklist_key !== expectedKey || record.content_sha256 !== expectedContentHash ||
      !HASH_PATTERN.test(record.pdf_sha256 || "") || !FILENAME_PATTERN.test(record.filename || "")) {
      throw new Error("PDF backup does not match this checklist");
    }
    const bytes = bytesFromBase64(record.pdf_base64, decode);
    if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") throw new Error("Invalid PDF file");
    const digest = digestHex(await cryptoApi.subtle.digest("SHA-256", bytes));
    if (digest !== record.pdf_sha256) throw new Error("PDF backup failed verification");
    return { bytes, filename: record.filename };
  }

  async function download(record, options) {
    const verified = await verify(
      record,
      options.expectedKey,
      options.expectedContentHash,
      globalScope.crypto,
      globalScope.atob.bind(globalScope)
    );
    if (options.isCurrent && !options.isCurrent()) throw new Error("Checklist context changed");
    const blob = new globalScope.Blob([verified.bytes], { type: "application/pdf" });
    const url = globalScope.URL.createObjectURL(blob);
    const link = globalScope.document.createElement("a");
    link.href = url;
    link.download = verified.filename;
    link.rel = "noopener";
    globalScope.document.body.append(link);
    link.click();
    link.remove();
    globalScope.setTimeout(() => globalScope.URL.revokeObjectURL(url), 1000);
    return verified.filename;
  }

  function storageKey(owner, key) {
    if (!/^[A-Za-z0-9-]{1,80}$/.test(owner || "") || !KEY_PATTERN.test(key || "")) throw new Error("Invalid PDF owner");
    return `opsdeck-pdf-v1:${owner}:${key}`;
  }

  async function readSaved(storage, owner, key, hash, cryptoApi = globalScope.crypto, decode = globalScope.atob?.bind(globalScope)) {
    try {
      const saved = JSON.parse(storage.getItem(storageKey(owner, key)) || "null");
      if (saved?.schemaVersion !== 1 || saved.userId !== owner) return null;
      await verify(saved.record, key, hash, cryptoApi, decode);
      return saved.record;
    } catch (_) { return null; }
  }

  async function prepare(storage, owner, key, hash, loader, isCurrent = () => true) {
    const cached = await readSaved(storage, owner, key, hash);
    if (!isCurrent()) return null;
    if (!loader) return cached;
    try {
      const record = await loader(hash);
      await verify(record, key, hash, globalScope.crypto, globalScope.atob.bind(globalScope));
      if (!isCurrent()) return null;
      try { storage.setItem(storageKey(owner, key), JSON.stringify({ schemaVersion: 1, userId: owner, record })); }
      catch (_) { /* Download remains possible when the offline PDF cannot be retained. */ }
      return record;
    } catch (_) { return isCurrent() ? cached : null; }
  }

  function forget(storage, owner, key) {
    try { storage.removeItem(storageKey(owner, key)); } catch (_) { /* Clear the signed-out UI even if storage fails. */ }
  }

  const api = { MAX_PDF_BYTES, verify, download, storageKey, readSaved, prepare, forget };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalScope.OpsDeckChecklistBackup = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
