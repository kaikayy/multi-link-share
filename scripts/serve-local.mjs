#!/usr/bin/env node
/**
 * Local end-to-end test of the custom viewer URL:
 *
 *   npm run serve:local
 *
 * Builds dist/chrome + dist/firefox + dist/viewer with the viewer base pinned to
 * http://localhost:8777/, then serves dist/viewer on that port. Load dist/chrome
 * (or dist/firefox) unpacked, set the same URL in the options page, create a
 * link, and open it — the import banner should appear.
 *
 * A plain `npm run build` (and the post-commit hook) resets the baked default,
 * so re-run this whenever you want the localhost build back.
 */
import { execFileSync } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = process.env.PORT || 8777;
const BASE = `http://localhost:${PORT}/`;

console.log(`Building with VIEWER_BASE=${BASE} …`);
execFileSync(process.execPath, [path.join(root, "scripts", "build.mjs")], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, VIEWER_BASE: BASE },
});

const dir = path.join(root, "dist", "viewer");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
};

http
  .createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0].split("#")[0]);
    let file = path.join(dir, url);
    if (!file.startsWith(dir)) {
      res.writeHead(403).end("forbidden");
      return;
    }
    if (file.endsWith("/") || !path.extname(file)) file = path.join(file, "index.html");
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404).end("not found");
        return;
      }
      res.writeHead(200, {
        "content-type": MIME[path.extname(file)] || "application/octet-stream",
        "cache-control": "no-store, must-revalidate",
      });
      res.end(data);
    });
  })
  .listen(PORT, () => {
    console.log(`\nviewer running at ${BASE}`);
    console.log("Next:");
    console.log("  1. Load dist/chrome (or dist/firefox) unpacked");
    console.log(`  2. Options → Viewer base URL → ${BASE} → Save (grant the host prompt)`);
    console.log("  3. Create a share link — it should point at localhost");
    console.log("  4. Open the link → the import banner appears\n");
  });
