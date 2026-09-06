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

  const api = { MAX_PDF_BYTES, verify, download };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalScope.OpsDeckChecklistBackup = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
