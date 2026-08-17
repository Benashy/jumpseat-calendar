import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const nextVersion = process.argv[2];
assert.match(nextVersion || "", /^\d+\.\d+$/, "Usage: npm run release -- 2.35");

const root = new URL("../", import.meta.url);
const releaseUrl = new URL("release.json", root);
const indexUrl = new URL("index.html", root);
const workerUrl = new URL("service-worker.js", root);
const appUrl = new URL("app.js", root);
const packageUrl = new URL("package.json", root);
const release = JSON.parse(await readFile(releaseUrl, "utf8"));
const assetNumber = Number(release.assetVersion.match(/\d+$/)?.[0]);
const cacheNumber = Number(release.cacheVersion.match(/\d+$/)?.[0]);
assert.ok(Number.isInteger(assetNumber) && Number.isInteger(cacheNumber), "Current release counters are invalid.");

const nextRelease = {
  appVersion: nextVersion,
  assetVersion: `cloud-sync-${assetNumber + 1}`,
  cacheVersion: `jumpseat-calendar-v${cacheNumber + 1}`,
};
let html = await readFile(indexUrl, "utf8");
let worker = await readFile(workerUrl, "utf8");
let app = await readFile(appUrl, "utf8");
const packageJson = JSON.parse(await readFile(packageUrl, "utf8"));

html = html
  .replaceAll(`v${release.appVersion}</small>`, `v${nextRelease.appVersion}</small>`)
  .replaceAll(release.assetVersion, nextRelease.assetVersion);
worker = worker
  .replaceAll(release.assetVersion, nextRelease.assetVersion)
  .replaceAll(release.cacheVersion, nextRelease.cacheVersion);
app = app.replace(
  `const APP_VERSION = "${release.appVersion}";`,
  `const APP_VERSION = "${nextRelease.appVersion}";`
);
packageJson.version = `${nextVersion}.0`;

await Promise.all([
  writeFile(releaseUrl, `${JSON.stringify(nextRelease, null, 2)}\n`),
  writeFile(indexUrl, html),
  writeFile(workerUrl, worker),
  writeFile(appUrl, app),
  writeFile(packageUrl, `${JSON.stringify(packageJson, null, 2)}\n`),
]);

console.log(`Prepared OpsDeck v${nextVersion}. Run npm run check before publishing.`);
