# Building & testing

## Reproducing the submitted Firefox add-on (Mozilla reviewers)

This source package builds with a single command and no installed
dependencies. Steps:

1. Install **Node.js 20 or later** (LTS 22.x also works).
   - Download the installer for your OS from https://nodejs.org, or install via
     a version manager (`nvm install 22`) or your OS package manager
     (`apt install nodejs`, `brew install node`, ...).
   - Verify: `node --version` must report `v20.x` or higher.
2. Install the **`zip`** command-line tool if it is not already on `PATH`.
   - Linux: usually preinstalled; otherwise `apt install zip` / `dnf install zip`.
   - macOS: preinstalled.
   - Windows: comes with Git for Windows (Git Bash), or install via WSL, or
     `choco install zip`.
3. From the root of this source package, run:
   ```bash
   npm run build
   ```
   This runs `node scripts/build.mjs` directly -- there is **no `npm install`
   step**; the project has zero npm dependencies.
4. The Firefox add-on is produced at `dist/firefox/`. This directory is
   byte-identical to the contents of the submitted `.xpi`.
5. Optional verification: `npm test` (= `node scripts/selftest.mjs`) runs the
   share-link codec's self-tests offline, no network access required.

**Operating system / environment:** any OS that can run Node.js 20+ and
provide a `zip` binary -- verified on Linux and macOS; Windows works via WSL,
Git Bash, or a standalone `zip.exe`. `scripts/build.mjs` is plain Node.js with
no OS-specific code paths.

**On source processing:** `scripts/build.mjs` performs exactly two small,
deterministic edits when assembling a store build (both readable directly in
that file, no obfuscation): it removes the `localhost` / `127.0.0.1` entries
from `manifest.json`'s `optional_host_permissions` array, and strips the
matching now-unreachable conditionals from `src/options.js` via a plain
text-replace. Every other source file ships exactly as authored -- nothing is
transpiled, bundled, or minified. The one vendored file is the third-party
`src/lib/lzstring.min.js` (lz-string 1.5.0, MIT license), fetched unmodified
from `https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.5.0/lz-string.min.js`
-- see [`THIRD-PARTY.md`](THIRD-PARTY.md).

---

> Just want to run your own copy? See **[`SELF-HOSTING.md`](SELF-HOSTING.md)**.
> The rest of this file is the dev workflow.

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
