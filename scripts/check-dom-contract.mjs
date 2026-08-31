import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [html, ...scripts] = await Promise.all([
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("app.js", root), "utf8"),
  readFile(new URL("radio-altimeter-ui.js", root), "utf8"),
  readFile(new URL("notoc-ui.js", root), "utf8"),
  readFile(new URL("gps-checklist-ui.js", root), "utf8"),
]);

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
assert.deepEqual(duplicateIds, [], `Duplicate HTML ids: ${duplicateIds.join(", ")}`);

const referencedIds = scripts.flatMap((script) => (
  [...script.matchAll(/document\.querySelector\("#([^"]+)"\)/g)].map((match) => match[1])
));
const missingIds = [...new Set(referencedIds.filter((id) => !ids.includes(id)))];
assert.deepEqual(missingIds, [], `JavaScript references missing HTML ids: ${missingIds.join(", ")}`);

console.log(`DOM contract valid: ${ids.length} unique ids and ${referencedIds.length} direct references checked.`);
