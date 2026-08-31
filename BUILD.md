# Building & testing

Requires **Node 18+**. The only system dependency for artwork is
`rsvg-convert` (package `librsvg`); it is not needed for a normal build.

```bash
npm test            # round-trip tests for the URL codec
npm run sync        # copy shared/ libs into extension/ and viewer/
npm run dev         # http://localhost:8778/dev/  — popup/options/viewer with a mocked chrome.*
npm run serve:viewer # http://localhost:8777/     — the real viewer, append #<token>
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

## Test the custom viewer URL locally

```bash
npm run serve:local        # builds against http://localhost:8777/ and serves dist/viewer
```

Then:

1. Load `dist/chrome/` (or `dist/firefox/manifest.json`) unpacked.
2. Options page → **Viewer base URL** → `http://localhost:8777/` → **Save**, and
   grant the one-time host-access prompt.
3. Create a share link — it now points at `localhost:8777`.
4. Open the link. Because the extension is installed, the **import banner** shows:
   open the collection into this window / a new window / a tab group, or save it
   to history.

A plain `npm run build` (and the post-commit hook) resets the baked default, so
re-run `serve:local` whenever you want the localhost build back.

## Deploying the viewer

`viewer/` (or `dist/viewer/`) is a plain static site — no build step, no server
code. Any of:

- **GitHub Pages:** push the repo, enable Pages, set the source to `/viewer`
  (or a `gh-pages` branch containing its contents). URL becomes
  `https://<user>.github.io/<repo>/`.
- **Netlify / Cloudflare Pages / Vercel:** point the project at the `viewer/`
  directory, no build command.
- **Any web host:** upload the four files + `lib/` + `assets/`.

The viewer must be served over **https** for the extension to accept it.

## Load the extension unpacked

- **Chrome:** `chrome://extensions` → Developer mode → *Load unpacked* →
  `dist/chrome/`
- **Firefox:** `about:debugging#/runtime/this-firefox` → *Load Temporary
  Add-on* → `dist/firefox/manifest.json`

## Lint (optional)

```bash
npx web-ext lint --source-dir dist/firefox
```
