#!/usr/bin/env node
/** Fails when a copy under extension/src/lib or viewer/lib differs from its
 *  shared/ original -- someone edited a copy, or forgot `npm run sync`. */
import fs from "node:fs";
import path from "node:path";
import { root, TARGETS } from "./shared-files.mjs";

let stale = 0;
for (const { dir, files } of TARGETS) {
  for (const f of files) {
    const copy = path.join(dir, f);
    const same = fs.existsSync(copy) && fs.readFileSync(copy).equals(fs.readFileSync(path.join(root, "shared", f)));
    if (!same) {
      stale++;
      console.error("  FAIL", path.relative(root, copy), "differs from shared/" + f);
    }
  }
}
if (stale) {
  console.error(`\n${stale} stale copies. Edit shared/, then run \`npm run sync\`.`);
  process.exitCode = 1;
} else {
  console.log("shared/ copies in sync.");
}
