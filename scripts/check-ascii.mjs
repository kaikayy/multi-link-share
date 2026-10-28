#!/usr/bin/env node
/** Enforces CONTRIBUTING.md's "ASCII punctuation only" in code, comments and
 *  docs: no en/em dashes, smart quotes, ellipsis or arrow glyphs. UI translation
 *  strings are exempt: the shared/i18n.js tables, extension/_locales, and HTML
 *  page text. Synced copies of shared/ and vendored *.min.js are skipped. */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { root } from "./shared-files.mjs";

const CHECKED = /\.(m?js|css|json|md)$/;
const SKIPPED = [/^extension\/src\/lib\//, /^viewer\/lib\//, /^extension\/_locales\//, /\.min\.js$/];
const I18N_ENTRY = /^\s+[a-z]\w*:\s*"/; // `  key: "translated text",` in shared/i18n.js

const FIX = {
  "\u2013": "-", "\u2014": "--", "\u2018": "'", "\u2019": "'", "\u201C": '"', "\u201D": '"',
  "\u2026": "...", "\u2192": "->", "\u2190": "<-", "\u21D2": "=>", "\u2194": "<->",
};
const BANNED = /[\u2013\u2014\u2018\u2019\u201C\u201D\u2026\u2190-\u21FF]/g;

const files = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
  .split("\n")
  .filter((f) => CHECKED.test(f) && !SKIPPED.some((re) => re.test(f)));

let hits = 0;
for (const f of files) {
  const lines = fs.readFileSync(path.join(root, f), "utf8").split("\n");
  lines.forEach((line, i) => {
    if (f === "shared/i18n.js" && I18N_ENTRY.test(line)) return;
    for (const m of line.matchAll(BANNED)) {
      hits++;
      console.error(`  ${f}:${i + 1}:${m.index + 1}  "${m[0]}" -> use "${FIX[m[0]] || "ASCII"}"`);
    }
  });
}
if (hits) {
  console.error(`\n${hits} non-ASCII punctuation marks (CONTRIBUTING.md, "Coding conventions").`);
  process.exitCode = 1;
} else {
  console.log(`ASCII punctuation OK (${files.length} files).`);
}
