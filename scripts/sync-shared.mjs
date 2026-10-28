#!/usr/bin/env node
/** Copies shared/ libraries into the working extension/ and viewer/ trees so
 *  both can be loaded directly (unpacked extension, or the viewer served as-is).
 *  `npm run build` does this too; run this after editing anything in shared/. */
import fs from "node:fs";
import path from "node:path";
import { root, TARGETS } from "./shared-files.mjs";

for (const { dir, files } of TARGETS) {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of files) {
    fs.copyFileSync(path.join(root, "shared", f), path.join(dir, f));
    console.log("  ok", path.relative(root, path.join(dir, f)));
  }
}
