import { readFile, mkdir, copyFile, rm } from "node:fs/promises";
import { dirname } from "node:path";
const root = new URL("../", import.meta.url);
const out = new URL("dist/", root);
const worker = await readFile(new URL("service-worker.js", root), "utf8");
const paths = JSON.parse(worker.match(/const APP_SHELL = (\[[\s\S]*?\]);/)[1]);
const files = new Set(paths.map((path) => path.split("?")[0].replace(/^\.\//, "") || "index.html"));
files.add("service-worker.js"); files.add("release.json");
await rm(out, { recursive: true, force: true });
for (const file of files) {
  if (file.includes("..") || file.startsWith("/")) throw new Error("Invalid publish path");
  const destination = new URL(file, out);
  await mkdir(dirname(destination.pathname), { recursive: true });
  await copyFile(new URL(file, root), destination);
}
console.log(`Prepared ${files.size} public files. Tests, database scripts and private content are excluded.`);
