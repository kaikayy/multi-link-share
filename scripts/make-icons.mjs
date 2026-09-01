#!/usr/bin/env node
/**
 * Regenerates PNG icons and store artwork from the SVG sources.
 * Requires `rsvg-convert` (package: librsvg) on PATH.
 *
 *   npm run icons
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
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

// hi-res icon + circular avatar (README, store listing icon, org avatar)
render(R("assets/icon-512.svg"), 512, 512, R("assets/icon-512.png"));
render(R("assets/icon-512.svg"), 1024, 1024, R("assets/icon-1024.png"));
render(R("assets/avatar-512.svg"), 512, 512, R("assets/avatar-512.png"));

// store promo tiles (designed artwork)
render(R("assets/promo-440x280.svg"), 440, 280, R("assets/promo-440x280.png"));   // Chrome Web Store small tile
render(R("assets/promo-440x280.svg"), 880, 560, R("assets/promo-880x560.png"));   // 2x
render(R("assets/promo-master.svg"), 3000, 2000, R("assets/promo-master-3000x2000.png")); // hi-res master

// simulated UI screenshots (1280x800 store size + 2x). Not real captures.
for (const name of ["screenshot-1-popup", "screenshot-2-viewer", "screenshot-3-viewer-grid", "screenshot-4-options"]) {
  render(R(`assets/${name}.svg`), 1280, 800, R(`assets/${name}.png`));
  render(R(`assets/${name}.svg`), 2560, 1600, R(`assets/${name}@2x.png`));
}

// link-unfurl card served with the viewer
render(R("assets/og-card.svg"), 1200, 630, R("viewer/assets/og-card.png"));

// promo banners (local artwork, git-ignored) -- regenerated only if the svgs are present
for (const b of ["promo-banner-tab-share", "promo-banner-suite"]) {
  if (fs.existsSync(R(`assets/${b}.svg`))) render(R(`assets/${b}.svg`), 1280, 640, R(`assets/${b}.png`));
  if (fs.existsSync(R(`assets/${b}-3x1.svg`))) render(R(`assets/${b}-3x1.svg`), 2400, 800, R(`assets/${b}-3x1.png`));
}

// Ko-fi "Buy me a Beer" sticker, one file per colour (git-ignored palette). The
// purple one is copied to viewer/assets/kofi-beer.svg (shipped) and the red one
// lives at extension/src/kofi-button.svg (shipped).
const KOFI_FAM = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const KOFI = {
  red: ["#FF5E5B", "#ffffff"], purple: ["#8b7dff", "#ffffff"], blue: ["#3B9EFF", "#ffffff"],
  green: ["#2FB170", "#ffffff"], orange: ["#FF8A3D", "#ffffff"], pink: ["#E85B9E", "#ffffff"],
  mono: ["#1b1b22", "#ffffff"], "mono-light": ["#f0f0f5", "#1b1b22"],
};
const kofiSvg = (pill, ink) => `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="52" viewBox="0 0 300 52" role="img" aria-label="Buy me a Beer on Ko-fi">
  <rect width="300" height="52" rx="14" fill="${pill}"/>
  <g transform="translate(18,9)">
    <g fill="${ink}"><circle cx="7" cy="8" r="5.5"/><circle cx="15" cy="5" r="6.5"/><circle cx="23" cy="8" r="5.5"/></g>
    <rect x="3" y="9" width="22" height="25" rx="3.5" fill="${ink}"/>
    <path d="M25 13 h5 a6 6 0 0 1 0 13 h-5" fill="none" stroke="${ink}" stroke-width="3.6"/>
    <circle cx="9" cy="19" r="2" fill="${pill}"/><circle cx="17" cy="25" r="2" fill="${pill}"/><circle cx="11" cy="29" r="1.6" fill="${pill}"/>
  </g>
  <text x="70" y="32" font-family="${KOFI_FAM}" font-size="17" font-weight="700" fill="${ink}">Buy me a Beer</text>
  <text x="282" y="33" text-anchor="end" font-family="${KOFI_FAM}" font-size="12" font-weight="600" fill="${ink}" opacity="0.9">ko-fi</text>
</svg>
`;
for (const [name, [pill, ink]] of Object.entries(KOFI)) {
  const svgPath = R(`assets/kofi-sticker-${name}.svg`);
  fs.writeFileSync(svgPath, kofiSvg(pill, ink));
  render(svgPath, 300, 52, R(`assets/kofi-sticker-${name}.png`));
}
fs.copyFileSync(R("assets/kofi-sticker-purple.svg"), R("viewer/assets/kofi-beer.svg"));
fs.copyFileSync(R("assets/kofi-sticker-red.svg"), R("extension/src/kofi-button.svg"));

console.log("Icons rebuilt.");
