# Changelog

All notable changes to Tab Share. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); dates are `YYYY-MM-DD`.

## [Unreleased]

_No entries yet._

## [1.0.0-beta.11] - 2026-09-05

Manifests: chrome `version` -> `1.0.0.11` (`version_name` -> `1.0.0-beta.11`),
firefox `version` -> `1.0.0.11`. Chrome has no independent numeric-version
requirement the way Firefox does, so its `version` now just tracks the beta
number directly instead of a separately incrementing counter. `beta.10` is
skipped deliberately -- Firefox's internal version had drifted ahead of the
beta number (`1.0.0.10` was `beta.9`) from an earlier Firefox-only submission;
jumping to `beta.11` brings both stores' numeric versions in line with their
own label (`1.0.0.11` == beta 11) going forward. Both stores are on `beta.9`
as of this release. Same permission set as beta.9. 17/17 tests green.

### Added

- **German and Spanish, throughout.** The viewer, the popup, the options page,
  and the "Open with Tab Share" import banner are all now available in
  English, German and Spanish (`shared/i18n.js`, synced into
  `extension/src/lib/` and `viewer/lib/` like the other shared libraries).
  Language is auto-detected from the browser once, then remembered.
  - The **viewer** has its own globe-icon button in its toolbar (opens a
    menu: English / Deutsch / Español, check mark on the active one) --
    it's a page with no separate settings surface of its own, so the
    switcher lives right there.
  - The **extension** (popup + options + the import banner) is translated
    the same way, but the language control lives on the **options page**
    (Preferences -> Language, a plain dropdown) rather than in the popup --
    the popup has no settings of its own either, so this keeps the one
    language choice in the one place that already holds every other
    preference.
- **Native `_locales/` support for the store listings.** Chrome and Firefox
  now read the extension's name and short description from
  `extension/_locales/<lang>/messages.json` (`default_locale: "en"`,
  `__MSG_appName__` / `__MSG_appDescription__` in both manifests) instead of a
  hardcoded English string -- covering en, de, es, fr, sv, uk, ja and zh_CN.
  This is separate from the in-app i18n above: it's the only mechanism the
  browsers themselves read before any of the extension's own code runs, and
  it's what Chrome Web Store now sources the listing's short Summary from.

## [1.0.0-beta.9] - 2026-09-04

Manifests: chrome `version` -> `1.0.0.3` (`version_name` -> `1.0.0-beta.9`),
firefox `version` -> `1.0.0.10`. Same permission set as beta.8. Firefox's
`1.0.0.5` (beta.5.5) is approved and listed on AMO -- this ships as an update,
not a first submission, so it should review faster.

### Added

- **Schema v4: a layered link + a "Minimal link" option.** The share token is
  now `[4, name, flags, urls[], ext?]` -- a required core plus an optional `ext`
  blob (`{ c: created, t: [titles] }`). A full link keeps everything v3 kept,
  URLs included exactly as given, byte-for-byte. A new **Minimal link**
  checkbox in the build view drops `ext` entirely -- URLs only, roughly half
  the characters, at the cost of page titles and the "shared on <date>" line
  (the viewer already falls back to the site name) -- and only a minimal link
  also strips ad/analytics query params (`utm_*`, `fbclid`, `gclid`, ~35 in
  all); they never change which page loads. **Every existing link still
  opens** -- the decoder reads v1, v2, v3 and v4. The live viewer at
  `kaikayy.github.io/multi-link-share/` already has the v4 decoder, so v4 links
  work today regardless of which build sent them. See
  [`docs/MINIMAL-LINKS.md`](docs/MINIMAL-LINKS.md).

## [1.0.0-beta.8] - 2026-09-02

Live on the Chrome Web Store. Manifests: chrome `version` -> `1.0.0.2`
(`version_name` -> `1.0.0-beta.8`), firefox `version` -> `1.0.0.9`. Same
permission set as beta.7 -- the shortener still only reaches the endpoint you
configure.

### Fixed

- **Tab Share shortener: large tab groups no longer fail with "HTTP 414".**
  A share link for a big group (many tabs, or long page URLs) could be 10 KB+.
  The extension used to hand that whole link to the shortener in the request
  URL, and a proxy in front of the server refused it as too long. It now sends
  the link in the request body instead, so the shortener takes links far larger
  than any real tab group. da.gd, TinyURL and custom endpoints are unchanged; if
  one of them rejects a link for being too long, the popup now says so and
  points you at the Tab Share shortener rather than showing a raw error number.

### Changed

- **Privacy policy: disclose what the first-party shortener records.** The
  `s.kaikay.de` instance keeps aggregate redirect stats (per-link hit counts
  and, by day, the referring host -- no full referrer, no path, no IP, no
  cookies, ~365-day retention). `PRIVACY.md`, `viewer/privacy.html` and
  `docs/CUSTOM-SHORTENER.md` now spell this out, the "no analytics/tracking"
  claim is scoped to the extension + viewer, and the options page notes it
  where you pick the shortener. The shortener repo gains its own `PRIVACY.md`.
  Follow-ups: the shortener's admin panel shows the target host only (a
  destination is revealed one link at a time); redirect analytics now also
  tally browser family + major version (never the full User-Agent, still no
  IP / geo / cookies); the shortener privacy policy gains an explicit "never
  sold" section and describes an on-request domain histogram. An operator that
  genuinely cannot read the shared collections stays on the shortener's
  roadmap. No behaviour change in the extension.

## [1.0.0-beta.7.5] - 2026-09-01

Manifests: chrome `version` -> `1.0.0.1` (Chrome needs a higher numeric
`version` than beta.7's `1.0.0` to accept the update; `version_name` stays
`1.0.0-beta.7.5`), firefox `version` -> `1.0.0.8`. Same permission set as
beta.7 -- a popup-copy change only, no new code paths.

### Added

- **Shortener tip in the popup.** A dismissable, compact banner at the top of
  the build view points at the built-in shortener (free, no account) with a
  *Set it up* link to the options page. Hidden once a shortener is configured;
  the dismissal sticks (`shortenerNoticeDismissed`).

## [1.0.0-beta.7] - 2026-09-01

Manifests: chrome `version_name` -> `1.0.0-beta.7`, firefox `version` ->
`1.0.0.7`. Same permission set as beta.5.5. (Supersedes the dev-only beta.6
tag, which never reached a store.)

### Changed

- **Options page rebuilt.** One scroll, card layout: a one-line welcome header
  that reads "Thanks for installing Tab Share!" and is highlighted the first
  time you open it -- along with the *Show real site icons* choice -- then
  reverts to "Welcome to Tab Share", plain, on every open after. Below it a
  two-column body --
  **Preferences**, **Support & feedback** and **Privacy** on the left, the
  bigger tiles (**Viewer base URL**, **Shorten links**, **History**) on the
  right. On a 1080p display the History card's first line is visible without
  scrolling; only the Privacy card sits below the fold. The title is now a gear
  glyph + "Tab Share"; "everything is optional / on-device" moved to a footer
  line; the section headers pick up a faint brand tint instead of reading as
  greyed-out; preference descriptions are a touch larger.
- **Picking a shortener no longer errors before you've configured it.** Choosing
  *Tab Share shortener* or *Custom endpoint* now just reveals its fields and
  persists the choice; validation and the host-permission prompt wait until you
  enter an address.
- The viewer footer's **Ko-fi** entry is now a compact "Buy me a Beer" sticker
  (a bundled purple SVG) pinned to the bottom-right of the viewport -- still a
  plain `<a href>`, still no network request until clicked. Checked against the
  slideshow nav / pagers / toast in every view.

### Added

- **First-party Tab Share shortener at `s.kaikay.de`.** Picking *Tab Share
  shortener* (labelled *recommended*) pre-fills the address with the public
  instance, which allow-lists the built-in viewer -- so the default viewer +
  shortener work with no configuration. Still Off until you turn it on; still
  opt-in per link. A stored address left pointing at `localhost` (from an old
  `DEV_LOCALHOST` build) is moved to the packaged default automatically -- both
  the popup and the options page do it on load, so the address field stops
  showing the dead `localhost` endpoint.
- **Long-link nudge.** When a created link is over the soft length limit and no
  shortener is set up, the result screen suggests turning one on and offers a
  *Set up the shortener* button. `shorten()` also requests the host permission
  itself if it's missing (a provider added or migrated without the grant).
  `SHORTENER_BASE=... npm run build` overrides the baked address.
- **da.gd as a built-in shortener option.** A small, no-account open-source
  shortener that keeps the `#…` fragment and takes multi-kilobyte links (where
  is.gd fails and TinyURL is hit-or-miss). Off by default like the rest. The
  Shorten-links card now notes that hosted shorteners -- `s.kaikay.de`, da.gd,
  TinyURL -- can't promise uptime or link longevity; a self-hosted **Tab Share
  shortener** is the durable choice. See
  [`docs/CUSTOM-SHORTENER.md`](docs/CUSTOM-SHORTENER.md).
- The options page carries a **Ko-fi "Buy me a Beer" button** (a bundled local
  SVG, not a remote image) plus **Report a bug** / **Request a feature** links
  to the GitHub issue forms, and a **Full privacy policy** link.
- A **Support** section in `README.md` with a Ko-fi button.
- `assets/kofi-sticker-*` -- the beer sticker in eight colours (git-ignored
  palette; regenerated by `npm run icons`, which also copies the purple one to
  the viewer and the red one to the options page).
- **`README.md` rework** -- the first lines now spell out that this is a browser
  extension and how it works, placeholder Chrome Web Store / Firefox Add-ons
  install links under the title, and a **browser-support table** (Chrome,
  Chromium, Edge, Brave, Opera, Vivaldi, Arc, Firefox + forks, Android, Safari)
  with a Tab Groups column.

### Removed

- The "is.gd and v.gd were removed" note under the shortener options -- long
  stale; the migration of a stored `isgd`/`vgd` choice to "off" stays.

## [1.0.0-beta.5.5] - 2026-09-01

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

- **Clearer shortener/viewer split in the options page and docs.** The
  "Shorten links" section now explains that your Viewer base URL is always
  yours to set, but a shortener only shortens links whose *viewer host is on
  that shortener's allowlist* -- your own shortener always allows your own
  viewer; someone else's has to opt your host in. `docs/CUSTOM-SHORTENER.md`
  gets a section on the same.

### Fixed

- Shortener host-permission requests were built from `URL.origin`, which
  includes the port -- not a valid match pattern, so `permissions.request()`
  rejected it and the failure was silently swallowed (the popup would just say
  "couldn't be reached"). Patterns are now `scheme://host/*` and request
  failures surface an error.
- When a shortener rejects a link, the popup now shows the reason it sent back
  (e.g. "host ... is not on this shortener's allowlist") instead of a bare
  "HTTP 400".

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
