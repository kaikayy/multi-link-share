# Tab Share

Bundle a group of tabs into **one link** that opens as a slideshow — and the
person you send it to needs no extension, no account, and hits no server.

![promo](assets/promo-440x280.png)

## What it does

1. Click the toolbar button. Pick your pages from:
   - **This window** — every open tab, pre-checked;
   - **Tab group** — a Chrome/Firefox tab group (optional permission);
   - **Paste links** — one URL per line, or pull in the current window.
2. Reorder / trim / name the collection.
3. **Create share link** → copy it.
4. The recipient opens it in any browser and gets a slideshow: a framed page
   view with a title bar, ◀ ▶ arrows, keyboard nav, a `3 / 12` counter and a
   progress bar, plus a **grid** overview and **open-all-in-tabs**.

## How one link can carry everything

The collection (page URLs + titles) is compressed with
[lz-string](https://github.com/pieroxy/lz-string) and written into the URL
**fragment** — the part after `#`. Browsers never transmit the fragment, so:

- no backend, no database, no accounts;
- the extension makes **zero network requests**;
- the link is self-contained (≈500 chars for 5 pages, ≈1.6 KB for 30).

A ~6 KB static page (`viewer/`) decodes the fragment in the recipient's browser
and renders the slideshow. You host it anywhere (see `BUILD.md`).

### The one honest limitation

Most big sites (Google, banks, X, …) send `X-Frame-Options` / CSP headers that
forbid being embedded in another page. So each slide shows a rich **preview
card** (title, domain, URL, "Open this page") by default, with an optional
**"Try live preview"** that attempts an `<iframe>`. Sites that allow framing
(many docs, blogs, Wikipedia) preview inline; the rest open in a real tab. The
grid view and "open all" sidestep the issue entirely.

## Permissions (deliberately tiny)

| Permission | Required? | Why |
|---|---|---|
| `tabs` | yes | Read URL + title of the current window's tabs, only on button click. |
| `storage` | yes | Remember your viewer URL + last 8 links, on-device (`storage.local`). |
| `tabGroups` | **optional**, asked at runtime | Read tab-group names for the "Tab group" source. |

No `host_permissions`. No content scripts. No background/service worker. No
remote code. No data collection. Full rationale in `STORE-LISTING.md`;
user-facing statement in `PRIVACY.md`.

## Repo layout

```
shared/            canonical codec + helpers (lz-string, share-codec, monogram)
extension/
  manifest.chrome.json / manifest.firefox.json
  src/             popup + options (plain HTML/CSS/JS, no framework)
  icons/           icon.svg + generated PNGs
viewer/            self-contained static slideshow site
assets/            store artwork (promo tile, screenshots)
dev/               mocked-chrome harness for eyeballing the UI (not shipped)
scripts/           build / sync / icons / selftest / dev-server
```

## Quick start

```bash
npm test                 # codec round-trip tests
npm run dev              # preview popup + viewer at localhost:8778
VIEWER_BASE=https://kaikayy.github.io/multi-link-share/ npm run build
```

Load `dist/chrome/` (Chrome) or `dist/firefox/manifest.json` (Firefox) unpacked.
Full instructions, deployment, and store submission: **`BUILD.md`**,
**`STORE-LISTING.md`**.

## Status

Works end-to-end (verified: window + tab-group capture, link creation, viewer
decode, slideshow/grid/live-preview). Before publishing you must:

1. deploy `viewer/` (GitHub Pages) — `config.js` already points at it;
2. swap the mockup screenshots in `assets/` for real captures;
3. host `PRIVACY.md` and link it in every store listing.

MIT licensed. Bundles lz-string (MIT) — see `THIRD-PARTY.md`.
