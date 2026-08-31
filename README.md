# Tab Share

Bundle a group of tabs into **one link** that opens as a slideshow — and the
person you send it to needs no extension, no account, and hits no server.

![promo](assets/promo-440x280.png)

> **Status: `1.0.0-beta.1`.** Feature-complete and tested; not yet on any store.
> Run your own copy with **[`SELF-HOSTING.md`](SELF-HOSTING.md)**.

## What it does

1. Click the toolbar button. Pick your pages from:
   - **Windows** — the current window's tabs, pre-checked; a picker appears if
     more than one window is open;
   - **Tab Groups** — pick a browser tab group and **＋ Add** it (combine several);
   - **Paste Links** — one URL per line, or pull in the current window's tabs.
2. Reorder / trim / rename the list. The list and the name survive closing the
   popup. Optionally set a password.
3. **Create share link** → it's copied to your clipboard automatically.
4. The recipient opens it in any browser. Four views, switched from **Change
   View**:
   - **Slideshow** — framed page, side + bottom arrows, first/last, keyboard
     nav, a clickable segmented pager, jump-to-page;
   - **Preview Grid** — large tiles with a live preview where the site allows it;
   - **Grid** — compact cards, numbered, full URL on hover;
   - **List** — a copyable numbered list (copy all, or links only).
   Per-view **search** filters by title / site / URL. **Select** mode adds
   checkboxes to any view and opens the checked pages in this window, a new
   window, or a new tab group. **Open all pages** opens every (filtered) page.
   **Light / dark** toggle, dark by default.

## How one link can carry everything

The collection (page URLs + titles) is compressed with
[lz-string](https://github.com/pieroxy/lz-string) and written into the URL
**fragment** — the part after `#`. Browsers never transmit the fragment, so:

- no backend, no database, no accounts;
- the extension makes **no network requests** (unless you turn on a URL shortener);
- the viewer makes **none** (unless you leave the site-icons option on, which
  fetches favicons from `icons.duckduckgo.com`);
- the link is self-contained (≈500 chars for 5 pages, ≈1.5 KB for 30);
- `"+"` is swapped out of the token so chat apps can't mangle it.

A small static page (`viewer/`) decodes the fragment in the recipient's browser
and renders the views. You host it anywhere — see **[`SELF-HOSTING.md`](SELF-HOSTING.md)**.

### Password-protected links

Tick **Protect with a password** and the whole collection is encrypted in your
browser (WebCrypto: PBKDF2-SHA-256, 210 000 iterations → AES-256-GCM) before it
goes in the link. The recipient types the password into the viewer to decrypt
locally — the password is never stored or sent. Lose it and the link can't be
opened.

### The one honest limitation

Most big sites (Google, banks, X, YouTube, …) send `X-Frame-Options` / CSP
headers that forbid being embedded in another page. `viewer/frame-hosts.js`
classifies hosts from a header probe of the ~730 most-visited / most-shared
domains (rebuild it with `tools/frame-probe/`):

- **framing-friendly** (Wikipedia, MDN-style docs, many reference and dev sites)
  preview inline automatically;
- **known blockers** show a clean card with just **"Open this page"**;
- **everything else** shows the card plus an opt-in **"Try live preview"** — and
  if that preview never loads, the viewer drops it and remembers the host for
  the session.

The grid views, **Open all pages**, and **Select → open** sidestep framing
entirely.

### If the recipient also has the extension

When a Tab Share link is opened in a browser that has the extension, a button
appears in the viewer's toolbar — **Open with Tab Share** — offering to open the
collection natively: into the current window, a new window, or a tab group, or
to **save it to history** with a title. Everyone else just gets the slideshow.
It's a content script that runs **only on the viewer page** (statically, just
the packaged viewer host); point the extension at your own viewer and the
options page asks you to approve that one host first. Hide the button from its
own menu or the options page; bring it back from the viewer's ⚙ menu.

## Permissions (deliberately tiny)

| Permission | Required? | Why |
|---|---|---|
| `tabs` | yes | Read URL + title + icon of the current window's tabs, only on button click. |
| `storage` | yes | Remember your viewer URL, setup choices, last 50 links, on-device (`storage.local`). |
| `tabGroups` | yes | The Tab Groups source, and creating a group on import (a content script can't request it at runtime). |
| `scripting` | yes | Register the import banner for a self-hosted viewer URL you set. |
| host access to a non-default viewer URL | **optional**, asked when you save one | Show the import button on your own viewer host. |
| host access to a shortener | **optional**, asked when you enable one | Send the generated link to is.gd / v.gd / TinyURL / your endpoint. |

No static `host_permissions`. One content script, scoped to the packaged viewer
host only (plus any host you opt into). A minimal background worker (import
actions + content-script registration). No remote code. No data collection.
Full rationale in `STORE-LISTING.md`; user-facing statement in `PRIVACY.md`.

## Repo layout

```
shared/            canonical codec + helpers (lz-string, share-codec, monogram)
extension/
  manifest.chrome.json / manifest.firefox.json
  src/             popup + options + background worker (plain HTML/CSS/JS)
  src/content/     import-banner.js — viewer-page "open with the extension" button
  icons/           icon.svg + generated PNGs
viewer/            self-contained static site (slideshow / preview grid / grid / list)
  frame-hosts.js   header-probed allow/deny list for auto-previewing sites
tools/frame-probe/ regenerates that list from live response headers
assets/            store artwork (promo tile, screenshots, og-card source)
dev/               mocked-chrome harness for eyeballing the UI (not shipped)
scripts/           build / sync / icons / selftest / dev-server
```

## Quick start

```bash
npm test                 # codec round-trip tests
npm run dev              # preview popup + options + import button at localhost:8778
npm run build            # dist/chrome + dist/firefox + dist/viewer
npm run serve:viewer     # serve the real viewer at localhost:8777, append #<token>
```

Load `dist/chrome/` (Chromium) or `dist/firefox/manifest.json` (Firefox)
unpacked. Full instructions for every OS / browser without a store:
**[`SELF-HOSTING.md`](SELF-HOSTING.md)**. Dev workflow: **`BUILD.md`**. Store
submission (for later): **`STORE-LISTING.md`**.

## Status

Verified end-to-end in Chrome: link creation from every source, the four viewer
views, navigation, the segmented pager at 14 and 50 pages, per-view search,
selection mode, theme toggle, password unlock, the empty-link state, and the
companion import button / reversible-hide flow (in the mocked dev harness — do a
real reloaded-extension pass before you publish). `viewer/` deploys to GitHub
Pages via `.github/workflows/deploy-viewer.yml`; the privacy policy is published
at `/privacy.html` alongside it. See `CHANGELOG.md` for what's changed and
`ROADMAP.md` for what's planned (notably an offline safer-links filter).

Licensed under the **GNU AGPL-3.0** — free to use, study, share, and modify, but
any modified version you distribute or run as a network service must be offered
under the same license with source available. Bundles lz-string (MIT) — see
`THIRD-PARTY.md`. Report security issues per `SECURITY.md`.
