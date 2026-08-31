#!/usr/bin/env node
/** Tiny static server for local viewer testing:  npm run serve:viewer
 *  Then open e.g. http://localhost:8777/#<token> */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "viewer");
const PORT = process.env.PORT || 8777;

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
  .listen(PORT, () => console.log(`viewer running at http://localhost:${PORT}/`));
