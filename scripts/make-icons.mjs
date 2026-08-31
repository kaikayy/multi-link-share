#!/usr/bin/env node
/**
 * Regenerates PNG icons and store artwork from the SVG sources.
 * Requires `rsvg-convert` (package: librsvg) on PATH.
 *
 *   npm run icons
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = (...p) => path.join(root, ...p);

function render(svg, w, h, out) {
  execFileSync("rsvg-convert", ["-w", String(w), "-h", String(h), svg, "-o", out], { stdio: "inherit" });
  console.log("  ✓", path.relative(root, out));
}

try {
  execFileSync("rsvg-convert", ["--version"], { stdio: "ignore" });
} catch (e) {
  console.error("rsvg-convert not found. Install librsvg (e.g. `sudo pacman -S librsvg` / `brew install librsvg`).");
  process.exit(1);
}

// toolbar / store icons
render(R("extension/icons/icon-small.svg"), 16, 16, R("extension/icons/icon-16.png"));
render(R("extension/icons/icon-small.svg"), 32, 32, R("extension/icons/icon-32.png"));
render(R("extension/icons/icon.svg"), 48, 48, R("extension/icons/icon-48.png"));
render(R("extension/icons/icon.svg"), 128, 128, R("extension/icons/icon-128.png"));

// store artwork
render(R("assets/promo-440x280.svg"), 440, 280, R("assets/promo-440x280.png"));
render(R("assets/screenshot-1-popup.svg"), 1280, 800, R("assets/screenshot-1-popup.png"));
render(R("assets/screenshot-2-viewer.svg"), 1280, 800, R("assets/screenshot-2-viewer.png"));

console.log("Icons rebuilt.");
