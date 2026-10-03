// Run locally with an authorised metadata export. No private wording or PDF bytes enter CI.
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const file = process.argv[2];
assert.ok(file, "Supply the private release-check SQL result as a JSON file.");
const manifest = JSON.parse(await readFile(new URL("../checklist-release.json", import.meta.url), "utf8"));
const rows = JSON.parse(await readFile(file, "utf8"));
for (const [key, expected] of Object.entries(manifest.checklists)) {
  const matches = rows.filter((row) => row.checklist_key === key);
  assert.ok(matches.length, `${key}: missing PDF`);
  for (const row of matches) {
    assert.equal(row.content_sha256, expected.contentSha256, `${key}: checklist revision mismatch`);
    assert.equal(row.pdf_sha256, expected.pdfSha256, `${key}: PDF revision mismatch`);
    assert.equal(row.source_matches, true, `${key}: PDF source differs from live checklist`);
    assert.equal(row.pdf_bytes_verified, true, `${key}: PDF bytes failed integrity check`);
  }
}
console.log("GPS and LVTO PDFs match the live content and approved release manifest.");
