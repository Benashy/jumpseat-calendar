const assert = require("node:assert/strict");
const test = require("node:test");
const { createHash, webcrypto } = require("node:crypto");
const backup = require("../checklist-backup");

const CONTENT_HASH = "a".repeat(64);
const pdf = Buffer.from("%PDF-1.4\n% private checklist test\n%%EOF\n", "utf8");
const PDF_HASH = createHash("sha256").update(pdf).digest("hex");
const decode = (value) => Buffer.from(value, "base64").toString("binary");

function record() {
  return {
    checklist_key: "gps",
    content_sha256: CONTENT_HASH,
    filename: "OpsDeck-GPS-Backup.pdf",
    pdf_sha256: PDF_HASH,
    pdf_base64: pdf.toString("base64"),
  };
}

test("private PDF backup must match the open checklist and its own digest", async () => {
  const verified = await backup.verify(record(), "gps", CONTENT_HASH, webcrypto, decode);
  assert.equal(verified.filename, "OpsDeck-GPS-Backup.pdf");
  assert.deepEqual(Buffer.from(verified.bytes), pdf);
});

test("private PDF backup rejects the wrong checklist, altered bytes and non-PDF data", async () => {
  await assert.rejects(backup.verify(record(), "lvto", CONTENT_HASH, webcrypto, decode), /does not match/);
  const altered = record();
  altered.pdf_base64 = Buffer.from("%PDF-1.4\naltered\n", "utf8").toString("base64");
  await assert.rejects(backup.verify(altered, "gps", CONTENT_HASH, webcrypto, decode), /failed verification/);
  const notPdf = record();
  const bytes = Buffer.from("plain text", "utf8");
  notPdf.pdf_base64 = bytes.toString("base64");
  notPdf.pdf_sha256 = createHash("sha256").update(bytes).digest("hex");
  await assert.rejects(backup.verify(notPdf, "gps", CONTENT_HASH, webcrypto, decode), /Invalid PDF file/);
});

function storage() {
  const data = new Map();
  return { data, getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}

test("verified PDF copies reopen offline only for their owner and current revision", async () => {
  const saved = storage();
  assert.deepEqual(await backup.prepare(saved, "one", "gps", CONTENT_HASH, async () => record()), record());
  assert.deepEqual(await backup.prepare(saved, "one", "gps", CONTENT_HASH, null), record());
  assert.equal(await backup.readSaved(saved, "two", "gps", CONTENT_HASH), null);
  assert.equal(await backup.readSaved(saved, "one", "gps", "b".repeat(64)), null);
  const envelope = JSON.parse(saved.getItem(backup.storageKey("one", "gps")));
  envelope.record.pdf_base64 = Buffer.from("%PDF-altered").toString("base64");
  saved.setItem(backup.storageKey("one", "gps"), JSON.stringify(envelope));
  assert.equal(await backup.readSaved(saved, "one", "gps", CONTENT_HASH), null);
});

test("restricted Wi-Fi preserves a verified PDF and sign-out removes it", async () => {
  const saved = storage();
  await backup.prepare(saved, "one", "gps", CONTENT_HASH, async () => record());
  assert.deepEqual(await backup.prepare(saved, "one", "gps", CONTENT_HASH, async () => { throw new Error("Restricted"); }), record());
  backup.forget(saved, "one", "gps");
  assert.equal(await backup.readSaved(saved, "one", "gps", CONTENT_HASH), null);
});

test("a late PDF fetch cannot cache content after account or checklist changes", async () => {
  const saved = storage();
  let release;
  let current = true;
  const pending = backup.prepare(saved, "one", "gps", CONTENT_HASH, () => new Promise(resolve => { release = resolve; }), () => current);
  await new Promise(resolve => setImmediate(resolve));
  current = false;
  release(record());
  assert.equal(await pending, null);
  assert.equal(saved.data.size, 0);
});

test("full storage does not block a verified PDF download record or fake readiness", async () => {
  const saved = storage();
  saved.setItem = () => { throw new Error("QuotaExceededError"); };
  assert.deepEqual(await backup.prepare(saved, "one", "gps", CONTENT_HASH, async () => record()), record());
  assert.equal(await backup.readSaved(saved, "one", "gps", CONTENT_HASH), null);
});
