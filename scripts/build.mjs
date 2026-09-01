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
 *   DEV_LOCALHOST=1  keep http://localhost + http://127.0.0.1 in
 *                    optional_host_permissions (for local end-to-end testing).
 *                    Auto-on when VIEWER_BASE or SHORTENER_BASE is a localhost
 *                    URL. Off otherwise -- every shipped build is https-only.
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
const SHORTENER_BASE = process.env.SHORTENER_BASE || "";
// Shipped builds are https-only: the http://localhost + http://127.0.0.1
// entries are stripped from optional_host_permissions and the options page
// rejects non-https shortener/viewer addresses. Fewer requested permissions
// (faster Chrome Web Store / AMO review) and nothing for Brave's localhost
// Shield to question. Local end-to-end testing keeps localhost -- either
// explicitly (DEV_LOCALHOST=1) or automatically when a localhost VIEWER_BASE /
// SHORTENER_BASE is baked in (npm run build:local, serve:local, the post-commit
// dev build).
const isLocalhostUrl = (u) => /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(u || "");
const LOCALHOST_PERMS =
  /^(1|true|yes)$/i.test(process.env.DEV_LOCALHOST || "") ||
  isLocalhostUrl(VIEWER_BASE) ||
  isLocalhostUrl(SHORTENER_BASE);

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
    if (SHORTENER_BASE) {
      const safe = SHORTENER_BASE.replace(/\/+$/, "");
      cfg = cfg.replace(/DEFAULT_SHORTENER_BASE:\s*"[^"]*"/, `DEFAULT_SHORTENER_BASE: "${safe}"`);
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
  if (!LOCALHOST_PERMS) {
    const mpath = path.join(out, "manifest.json");
    const m = JSON.parse(fs.readFileSync(mpath, "utf8"));
    if (Array.isArray(m.optional_host_permissions)) {
      m.optional_host_permissions = m.optional_host_permissions.filter(
        (p) => !/^https?:\/\/(localhost|127\.0\.0\.1)\//.test(p),
      );
    }
    fs.writeFileSync(mpath, JSON.stringify(m, null, 2) + "\n");
    // Keep options.js from advertising a localhost shortener it can't be granted.
    const opath = path.join(out, "src", "options.js");
    let o = fs.readFileSync(opath, "utf8");
    o = o.replace(
      /parsed\.protocol !== "https:" && parsed\.hostname !== "localhost" && parsed\.hostname !== "127\.0\.0\.1"/g,
      'parsed.protocol !== "https:"',
    );
    o = o.replace(/const localhost = [^;]+;\n\s*/g, "");
    o = o.replace(/ && !localhost\b/g, "");
    o = o.replace(/ \(localhost is allowed for testing\)/g, "");
    fs.writeFileSync(opath, o);
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
console.log(
  `Tab Share build -- v${version}` +
    `${VIEWER_BASE ? ` (viewer: ${VIEWER_BASE})` : ""}` +
    `${SHORTENER_BASE ? ` (shortener: ${SHORTENER_BASE})` : ""}` +
    `${LOCALHOST_PERMS ? " (dev: localhost perms kept)" : ""}`,
);
buildExtension("chrome", "manifest.chrome.json");
buildExtension("firefox", "manifest.firefox.json");
buildViewer();
console.log("Done.");
