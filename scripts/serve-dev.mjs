#!/usr/bin/env node
/** Dev harness server (NOT for production). Serves the repo so you can eyeball
 *  the popup / options / viewer in a normal tab with a mocked `chrome.*`.
 *
 *    npm run dev
 *    → http://localhost:8778/dev/          (index of previews)
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = process.env.PORT || 8778;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
};

const INDEX = `<!doctype html><meta charset=utf-8><title>Tab Share dev previews</title>
<body style="font-family:system-ui;background:#1a1a20;color:#eee;padding:40px;line-height:1.8">
<h1>Tab Share — dev previews</h1>
<ul>
  <li><a style="color:#9a8dff" href="/dev/popup-inner.html">Popup</a> (mocked chrome.*)</li>
  <li><a style="color:#9a8dff" href="/dev/options-inner.html">Options page</a> (mocked chrome.*)</li>
  <li><a style="color:#9a8dff" href="/viewer/">Viewer</a> — append <code>#&lt;token&gt;</code> from <code>npm test</code> output or the popup</li>
</ul></body>`;

function injectedPage(htmlPath) {
  let html = fs.readFileSync(path.join(root, htmlPath), "utf8");
  const dir = "/" + path.dirname(htmlPath) + "/";
  // rewrite relative asset refs to absolute repo paths
  html = html.replace(/(src|href)="(?!https?:|\/|#|data:)([^"]+)"/g, (_, attr, ref) => `${attr}="${dir}${ref}"`);
  // preload the mock
  html = html.replace(/<head>/i, `<head>\n<script src="/dev/mock-browser.js"></script>`);
  return html;
}

http
  .createServer((req, res) => {
    let url = decodeURIComponent(req.url.split("?")[0]);
    const send = (code, type, body) => {
      res.writeHead(code, { "content-type": type, "cache-control": "no-store" });
      res.end(body);
    };

    if (url === "/" || url === "/dev" || url === "/dev/") return send(200, MIME[".html"], INDEX);
    if (url === "/dev/popup-inner.html") return send(200, MIME[".html"], injectedPage("extension/src/popup.html"));
    if (url === "/dev/options-inner.html") return send(200, MIME[".html"], injectedPage("extension/src/options.html"));
    if (url === "/viewer" || url === "/viewer/") url = "/viewer/index.html";

    const file = path.join(root, url);
    if (!file.startsWith(root)) return send(403, "text/plain", "forbidden");
    fs.readFile(file, (err, data) => {
      if (err) return send(404, "text/plain", "not found");
      send(200, MIME[path.extname(file)] || "application/octet-stream", data);
    });
  })
  .listen(PORT, () => console.log(`dev previews at http://localhost:${PORT}/dev/`));
