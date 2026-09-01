# Building & testing

> Just want to run your own copy? See **[`SELF-HOSTING.md`](SELF-HOSTING.md)**.
> This file is the dev workflow.

Requires **Node 20+** (`npm test` uses WebCrypto) and the system **`zip`**
command. No npm dependencies -- `web-ext` (Firefox packaging / lint) is optional
and run via `npx`. `rsvg-convert` (package `librsvg`) is only needed for
`npm run icons`.

`npm run icons` also renders `assets/og-card.svg` -> `viewer/assets/og-card.png`
(1200×630), the image chat apps show when a viewer link is unfurled.

`viewer/frame-hosts.js` classifies which sites are worth auto-previewing in an
`<iframe>`. It ships with the viewer verbatim (no build step). Regenerate it
from live response headers with `tools/frame-probe/` (see its README) -- probe
the domain list, then fold the results plus the hand-review overrides into the
`GOOD` / `BAD` arrays.

```bash
npm test            # round-trip tests for the URL codec
npm run sync        # copy shared/ libs into extension/ and viewer/
npm run dev         # http://localhost:8778/dev/  -- popup/options/viewer with a mocked chrome.*
npm run serve:viewer # http://localhost:8777/     -- the real viewer, append #<token>
npm run icons       # regenerate PNG icons + store art from the SVG sources
npm run build       # produce dist/chrome, dist/firefox, dist/viewer + zips
npm run zip:source  # produce dist/tab-share-source-*.zip for AMO
```

## Set your viewer URL

The share link is `<viewer base>#<token>`. `config.js` ships pointing at
`https://kaikayy.github.io/multi-link-share/`. To build against a different
deployment:

```bash
VIEWER_BASE=https://example.com/viewer/ npm run build
```

This overrides the baked-in default for that build only. Users can also change
it in the extension's options page.

## Shipped builds are https-only

Every build is https-only by default: `npm run build` strips
`http://localhost/*` and `http://127.0.0.1/*` from `optional_host_permissions`
and the options page rejects non-https viewer and shortener addresses. Fewer
requested permissions (faster Chrome Web Store / AMO review) and nothing for
Brave's localhost Shield to question. This is the only build you should upload
to a store.

Local end-to-end testing keeps the localhost entries. It turns on
automatically when a localhost address is baked in -- `npm run build:local`,
`npm run serve:local`, and the post-commit dev build all do this -- or
explicitly:

```bash
DEV_LOCALHOST=1 npm run build
```

## Test the custom viewer URL locally

```bash
npm run serve:local        # builds against http://localhost:8777/ and serves dist/viewer
```

Then:

1. Load `dist/chrome/` (or `dist/firefox/manifest.json`) unpacked.
2. Options page -> **Viewer base URL** -> `http://localhost:8777/` -> **Save**, and
   grant the one-time host-access prompt.
3. Create a share link -- it now points at `localhost:8777`.
4. Open the link. Because the extension is installed, the **import banner** shows:
   open the collection into this window / a new window / a tab group, or save it
   to history.

A plain `npm run build` (and the post-commit hook, unless you export
`SHORTENER_BASE=`) resets the baked default and drops the localhost permissions
again, so re-run `serve:local` whenever you want the localhost build back.

## Deploying the viewer

`viewer/` (or `dist/viewer/`) is a plain static site -- no build step, no server
code. Any of:

- **GitHub Pages:** push the repo, enable Pages, set the source to `/viewer`
  (or a `gh-pages` branch containing its contents). URL becomes
  `https://<user>.github.io/<repo>/`.
- **Netlify / Cloudflare Pages / Vercel:** point the project at the `viewer/`
  directory, no build command.
- **Any web host:** upload the four files + `lib/` + `assets/`.

The viewer must be served over **https** for the extension to accept it.

## Load the extension unpacked

- **Chrome:** `chrome://extensions` -> Developer mode -> *Load unpacked* ->
  `dist/chrome/`
- **Firefox:** `about:debugging#/runtime/this-firefox` -> *Load Temporary
  Add-on* -> `dist/firefox/manifest.json`

Content scripts and the background worker do **not** hot-reload -- after a
rebuild, click the reload icon in the extensions page. Every OS / browser combo,
and the permanent-install (signing) options, are in `SELF-HOSTING.md`.

## Lint (required before an AMO submission)

```bash
npx web-ext@8 lint --source-dir dist/firefox   # must be 0 errors / 0 warnings / 0 notices
```

## Version

`package.json` holds the full semver (`1.0.0-beta.1`) and drives the zip names.
`extension/manifest.chrome.json` keeps a numeric `version` plus a `version_name`
for the pre-release tag; `extension/manifest.firefox.json` is numeric-only (MV3
on AMO rejects letters). Bump all three together.

## Post-commit sync (local only)

`.git/hooks/post-commit` (untracked, set up per machine) runs `npm run build`
and rsyncs `dist/{chrome,firefox}` to `~/.local/share/tab-share-ext/` so a
loaded unpacked extension picks up changes on the next reload.
