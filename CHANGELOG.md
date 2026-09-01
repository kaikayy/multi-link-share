# Changelog

All notable changes to Tab Share. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); dates are `YYYY-MM-DD`.

## [Unreleased]

### Changed

- **Shipped builds are https-only.** `npm run build` now strips
  `http://localhost/*` and `http://127.0.0.1/*` from `optional_host_permissions`
  and the options page rejects non-https viewer and shortener addresses. Store
  uploads request one permission group (`https://*/*`) instead of three, and
  there is nothing for Brave's localhost Shield to flag. Local end-to-end
  testing still gets the localhost entries -- automatically when a localhost
  `VIEWER_BASE` / `SHORTENER_BASE` is baked in (`build:local`, `serve:local`,
  the post-commit dev build), or explicitly with `DEV_LOCALHOST=1 npm run
  build`. See [`docs/BUILD.md`](docs/BUILD.md).

### Added

- **"Tab Share shortener" as a built-in shortener option.** A dedicated,
  self-hostable service ([tab-share-shortener](https://github.com/kaikayy/tab-share-shortener))
  that shortens long share links -- including the multi-kilobyte ones TinyURL
  and is.gd choke on. Options -> Shorten links -> pick **Tab Share shortener**,
  enter its address, and choose a **Short link style**: *Normal* (random code,
  e.g. `/k7Rm2pq`) or *Readable words* (e.g. `/swift-amber-otter`). Off by
  default, same as the other shortener options; nothing is sent anywhere until
  you turn it on. See [`docs/CUSTOM-SHORTENER.md`](docs/CUSTOM-SHORTENER.md).
- `SHORTENER_BASE=... npm run build` bakes a default shortener address into the
  build (pre-fills the address field only; the shortener still starts Off),
  mirroring `VIEWER_BASE`.

### Fixed

- Shortener host-permission requests were built from `URL.origin`, which
  includes the port -- not a valid match pattern, so `permissions.request()`
  rejected it and the failure was silently swallowed (the popup would just say
  "couldn't be reached"). Patterns are now `scheme://host/*` and request
  failures surface an error.

## [1.0.0-beta.5] - 2026-08-31

### Changed

- **Narrowed `optional_host_permissions`** from `*://*/*` to
  `https://*/*` + `http://localhost/*` + `http://127.0.0.1/*`. The extension only
  ever requests one specific `https` (or localhost) origin at a time -- for a
  self-hosted viewer URL or a custom shortener endpoint -- so the plain-`http`
  wildcard was never used. Custom shortener endpoints must now be `https://`
  (localhost excepted), matching the viewer-URL rule.

## [1.0.0-beta.4] - 2026-08-31

_(beta.3 was tagged but not released -- its fix is folded in here.)_

### Fixed

- **URL shorteners actually work now, and tell you when they don't.**
  - **is.gd and v.gd removed** -- they reject any URL with a `#` fragment (every
    share link has one) and block `github.io`, so they always failed.
  - **TinyURL kept** -- it preserves the fragment and handles multi-KB links.
  - `shorten()` reports the real reason (unreachable / HTTP error / rejected
    long-or-fragment URL / result not actually shorter) instead of a silent
    fail.
  - **Auto-shorten failures are now visible.** The failure message was a toast
    that the "link copied" toast instantly overwrote; it's now a persistent note
    on the result screen with a **Try shortening again** button, and the full
    link is kept.
  - A stored `is.gd` / `v.gd` choice is migrated to "off" on upgrade.
- **The viewer can now tell when the recipient has the extension.** It was
  checking a content-script global (`window.__tabShare`) that lives in an
  isolated world the page can't read, so it *always* thought the extension was
  absent. As a result **"Open all pages" and "Open selected -> new window / tab
  group" never used the extension** even when it was installed -- they fell back
  to `window.open` (pop-up-blocked) and a misleading "install Tab Share" toast.
  Now the content script sets a `data-tabshare-ext` attribute and the two sides
  talk over `postMessage` (same-origin only), so with the extension installed
  every tab opens cleanly through the tabs API.

### Added

- **`docs/CUSTOM-SHORTENER.md`** -- how to run your own shortener endpoint
  (Cloudflare Worker / Deno / YOURLS samples) and connect it. `ROADMAP.md` now
  lists a first-party Tab Share shortener as the intended default.

## [1.0.0-beta.2] - 2026-08-31

### Fixed

- **"Open all pages" now actually opens them.** It was firing `window.open` from
  a `setTimeout` loop, so the browser blocked every tab. It now hands the list
  to the extension when one is present (opens every tab cleanly), and otherwise
  opens synchronously inside the click and tells you if pop-ups were blocked.
  Same fix for **Select -> Open selected -> In this window**.

### Docs

- `ROADMAP.md` added -- the planned **safer-links filter** (offline warnings for
  malware / phishing / adult / gambling hosts from public blocklists) and link
  expiry.

## [1.0.0-beta.1] - 2026-08-31

First public beta. Not on any store -- install via
[`docs/SELF-HOSTING.md`](docs/SELF-HOSTING.md).

### Extension

- Three page sources: **Windows** (with a multi-window picker), **Tab Groups**
  (pick and **+ Add**, combine several), **Paste Links** (or pull in open tabs).
- Reorder / trim / rename the list; select-all / none. The list, the collection
  name, and the last-used source survive closing the popup.
- Adding a tab group seeds the collection name from the group title.
- **Password-protected links** -- client-side WebCrypto (PBKDF2-SHA-256, 210 000
  iterations -> AES-256-GCM); the password is never stored or sent.
- Optional **URL shortener** (is.gd / v.gd / TinyURL / custom endpoint),
  off by default, host-permission gated.
- Options page with first-run welcome, a per-device history of the last 50
  links, and a **custom viewer URL** (self-hosting) with a one-time host prompt.
- Companion **import button** on the viewer page: open a received collection
  into this window / a new window / a tab group, or save it to history. Closed
  shadow-DOM menu, `event.isTrusted`-guarded, sender-validated background
  messages. Reversible-hide from the button's menu, the options page, or the
  viewer's settings menu -- all in sync.

### Viewer (static site)

- Four views: **Slideshow**, **Preview Grid**, **Grid**, **List** -- switched
  from a **Change View** tile menu.
- Slideshow: framed page, side + bottom arrows, first/last, keyboard nav, a
  clickable segmented pager that scales to any page count, jump-to-page.
- Per-view **search** (title / site / URL) and **Select** mode (checkboxes in
  every view -> open the checked pages in this window / a new window / a tab
  group). **Open all pages** opens every filtered page.
- **Light / dark** toggle, dark by default, applied before first paint.
- Optional **site icons** from `icons.duckduckgo.com` -- off by default; with it
  off the viewer makes **zero** network requests.
- `frame-hosts.js` built from a live `X-Frame-Options` / CSP probe of ~730 of
  the most-visited / most-shared domains (`tools/frame-probe/`): framing-friendly
  hosts auto-preview, known blockers show only "Open this page", the rest get an
  opt-in "Try live preview" that falls back to the card (and is remembered for
  the session) if it never loads.
- OpenGraph unfurl tags + a generated share card for chat apps.
- Strict CSP; password-unlock screen; graceful empty / broken-link state.

### Codec

- Schema **v3** `[3, name, created, pages, flags]` (`flags` bit 0 = suggest
  icons, bit 1 = auto-preview); v1 / v2 links still decode. `+`->`_` swap so chat
  apps can't mangle a token.

### Packaging

- Chrome + Firefox MV3 manifests; `web-ext lint` clean (0/0/0). Chrome shows the
  beta tag via `version_name`; the Firefox manifest version is numeric-only as
  MV3 now requires. `npm run build` -> `dist/{chrome,firefox,viewer}` + zips.
- Relicensed to **GNU AGPL-3.0-only**.
