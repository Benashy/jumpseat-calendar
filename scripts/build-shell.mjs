import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const workerUrl = new URL("service-worker.js", root);
const worker = await readFile(workerUrl, "utf8");
const paths = JSON.parse(worker.match(/const APP_SHELL = (\[[\s\S]*?\]);/)[1]);
const hashes = {};
for (const path of paths) {
  const relative = path === "./" ? "index.html" : path.split("?")[0];
  hashes[path] = createHash("sha256").update(await readFile(new URL(relative, root))).digest("hex");
}
const generated = `const SHELL_INTEGRITY = ${JSON.stringify(hashes)};`;
if (process.argv.includes("--check")) {
  if (!worker.includes(generated)) throw new Error("Shell integrity is stale. Run npm run prepare:release.");
} else {
  await writeFile(workerUrl, worker.replace(/const SHELL_INTEGRITY = .*;/, generated));
}
console.log(`Verified shell manifest: ${paths.length} resources.`);
