import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [releaseText, html, serviceWorker, app] = await Promise.all([
  readFile(new URL("release.json", root), "utf8"),
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("service-worker.js", root), "utf8"),
  readFile(new URL("app.js", root), "utf8"),
]);
const release = JSON.parse(releaseText);

const displayedVersions = [...html.matchAll(/class="app-version">v([^<]+)</g)].map((match) => match[1]);
assert.equal(displayedVersions.length, 3, "Expected one version label in each account footer.");
assert.ok(displayedVersions.every((version) => version === release.appVersion), "Visible version labels do not match release.json.");

const appVersionMatch = app.match(/const APP_VERSION = "([^"]+)"/);
assert.equal(appVersionMatch?.[1], release.appVersion, "The backup version in app.js does not match release.json.");

const assetVersions = [...`${html}\n${serviceWorker}`.matchAll(/cloud-sync-\d+/g)].map((match) => match[0]);
assert.ok(assetVersions.length >= 10, "Expected versioned app assets in HTML and the service worker.");
assert.ok(assetVersions.every((version) => version === release.assetVersion), "Asset versions do not match release.json.");

const cacheMatch = serviceWorker.match(/const CACHE_NAME = "([^"]+)"/);
assert.equal(cacheMatch?.[1], release.cacheVersion, "Service worker cache does not match release.json.");

const shellPaths = [...serviceWorker.matchAll(/"\.\/([^"?]+)(?:\?[^" ]*)?"/g)]
  .map((match) => match[1])
  .filter((path) => path && path !== "");
for (const path of new Set(shellPaths)) await access(new URL(path, root));

console.log(`Release ${release.appVersion} is internally consistent (${release.assetVersion}, ${release.cacheVersion}).`);
