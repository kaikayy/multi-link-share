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
  <li><a style="color:#9a8dff" href="/dev/import-banner.html">Import banner</a> (mocked chrome.*)</li>
  <li><a style="color:#9a8dff" href="/viewer/">Viewer</a> — append <code>#&lt;token&gt;</code> from <code>npm test</code> output or the popup</li>
</ul></body>`;

const BANNER = `<!doctype html><meta charset=utf-8><title>Import button preview</title>
<link rel="stylesheet" href="/viewer/tab-share.css">
<script src="/dev/mock-browser.js"></script>
<script src="/shared/lzstring.min.js"></script>
<script src="/shared/share-codec.js"></script>
<body>
<svg width=0 height=0 style="position:absolute"><symbol id="v-ext" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/></symbol></svg>
<header class="v-bar"><div class="v-brand"><span class="v-logo"></span><div class="v-titles"><h1>Preview</h1></div></div>
<div class="v-tools">
  <button class="v-btn ghost">Open all pages</button>
  <button class="v-btn">Change View</button>
  <div class="v-menu-wrap">
    <button id="btn-settings" class="v-btn ghost icon-only" type="button">⚙</button>
    <div id="settings-menu" class="v-menu" hidden role="menu">
      <label class="v-menu-check"><input type="checkbox" id="set-autopreview"><span>Auto-load live previews</span></label>
      <label class="v-menu-check"><input type="checkbox" id="set-icons"><span>Show site icons</span></label>
    </div>
  </div>
</div></header>
<p style="padding:24px;color:var(--text-dim)">The content script adds "Open with Tab Share" to the toolbar, and a
"Show the button" checkbox into the ⚙ menu (click ⚙). Actions log to the console.</p>
<script>document.getElementById('btn-settings').addEventListener('click',()=>{const m=document.getElementById('settings-menu');m.hidden=!m.hidden;});<\/script>
<script>
  var token = ShareCodec.encode({
    title: "Sample collection",
    pages: [
      { u: "https://en.wikipedia.org/wiki/Aurora", t: "Aurora" },
      { u: "https://unsplash.com/s/photos/mountains", t: "Mountains" },
      { u: "https://commons.wikimedia.org/wiki/Main_Page", t: "" },
    ],
  });
  location.hash = token;
<\/script>
<script src="/extension/src/content/import-banner.js"></script>
</body>`;

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
    if (url === "/dev/import-banner.html") return send(200, MIME[".html"], BANNER);
    if (url === "/viewer" || url === "/viewer/") url = "/viewer/index.html";

    const file = path.join(root, url);
    if (!file.startsWith(root)) return send(403, "text/plain", "forbidden");
    fs.readFile(file, (err, data) => {
      if (err) return send(404, "text/plain", "not found");
      send(200, MIME[path.extname(file)] || "application/octet-stream", data);
    });
  })
  .listen(PORT, () => console.log(`dev previews at http://localhost:${PORT}/dev/`));
