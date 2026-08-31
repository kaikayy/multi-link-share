#!/usr/bin/env node
/**
 * Assembles distributable folders and zips:
 *
 *   dist/chrome/    + dist/tab-share-chrome-v<version>.zip     -> Chrome Web Store
 *   dist/firefox/   + dist/tab-share-firefox-v<version>.zip    -> addons.mozilla.org
 *   dist/viewer/    + dist/tab-share-viewer-v<version>.zip     -> any static host
 *
 * Optional env:
 *   VIEWER_BASE=https://you.github.io/tab-share-ext/  (bakes the default viewer URL)
 *
 * No dependencies. Uses the system `zip` binary.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const version = pkg.version;
const VIEWER_BASE = process.env.VIEWER_BASE || "";

const SHARED = ["lzstring.min.js", "share-codec.js", "monogram.js"];

function rimraf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}
function syncShared(libDir, withConfig) {
  fs.mkdirSync(libDir, { recursive: true });
  for (const f of SHARED) fs.copyFileSync(path.join(root, "shared", f), path.join(libDir, f));
  if (withConfig) {
    let cfg = fs.readFileSync(path.join(root, "shared", "config.js"), "utf8");
    if (VIEWER_BASE) {
      const safe = VIEWER_BASE.endsWith("/") ? VIEWER_BASE : VIEWER_BASE + "/";
      cfg = cfg.replace(/DEFAULT_VIEWER_BASE:\s*"[^"]*"/, `DEFAULT_VIEWER_BASE: "${safe}"`);
    }
    fs.writeFileSync(path.join(libDir, "config.js"), cfg);
  }
}
function zipDir(dir, zipPath) {
  rimraf(zipPath);
  execFileSync("zip", ["-qr", "-X", zipPath, "."], { cwd: dir, stdio: "inherit" });
}

function buildExtension(target, manifestFile) {
  const out = path.join(dist, target);
  rimraf(out);
  copyDir(path.join(root, "extension"), out);
  // pick the manifest
  fs.copyFileSync(path.join(out, manifestFile), path.join(out, "manifest.json"));
  for (const f of ["manifest.chrome.json", "manifest.firefox.json"]) {
    fs.rmSync(path.join(out, f), { force: true });
  }
  // dev-only helper art not needed in the package
  fs.rmSync(path.join(out, "icons", "icon-small.svg"), { force: true });
  syncShared(path.join(out, "src", "lib"), true);
  const zip = path.join(dist, `tab-share-${target}-v${version}.zip`);
  zipDir(out, zip);
  console.log("  ✓", path.relative(root, zip));
}

function buildViewer() {
  const out = path.join(dist, "viewer");
  rimraf(out);
  copyDir(path.join(root, "viewer"), out);
  syncShared(path.join(out, "lib"), false);
  const zip = path.join(dist, `tab-share-viewer-v${version}.zip`);
  zipDir(out, zip);
  console.log("  ✓", path.relative(root, zip));
}

fs.mkdirSync(dist, { recursive: true });
console.log(`Tab Share build — v${version}${VIEWER_BASE ? ` (viewer: ${VIEWER_BASE})` : ""}`);
buildExtension("chrome", "manifest.chrome.json");
buildExtension("firefox", "manifest.firefox.json");
buildViewer();
console.log("Done.");
