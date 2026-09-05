#!/usr/bin/env node
/** Copies shared/ libraries into the working extension/ and viewer/ trees so
 *  both can be loaded directly (unpacked extension, or the viewer served as-is).
 *  `npm run build` does this too; run this after editing anything in shared/. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shared = path.join(root, "shared");

const targets = [
  { dir: path.join(root, "extension", "src", "lib"), files: ["lzstring.min.js", "share-codec.js", "monogram.js", "config.js", "i18n.js"] },
  { dir: path.join(root, "viewer", "lib"), files: ["lzstring.min.js", "share-codec.js", "monogram.js", "i18n.js"] },
];

for (const { dir, files } of targets) {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of files) {
    fs.copyFileSync(path.join(shared, f), path.join(dir, f));
    console.log("  ✓", path.relative(root, path.join(dir, f)));
  }
}
