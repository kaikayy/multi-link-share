#!/usr/bin/env node
/** Produces dist/tab-share-source-v<version>.zip for Mozilla AMO.
 *  AMO requires the full source whenever a reviewer can't read the submitted
 *  files directly (this add-on vendors the minified lz-string library, so
 *  attach this and point docs/BUILD.md at `npm run build`). */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const out = path.join(root, "dist", `tab-share-source-v${pkg.version}.zip`);

fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.rmSync(out, { force: true });

execFileSync(
  "zip",
  ["-qr", "-X", out, ".", "-x", "dist/*", ".git/*", "node_modules/*", "*.DS_Store"],
  { cwd: root, stdio: "inherit" }
);
console.log("  ✓", path.relative(root, out));
