# Self-hosting Tab Share

Tab Share has two parts, and to run your own copy you set up both:

| Part | What it is | Where it runs |
|---|---|---|
| **The viewer** | a tiny static site (`viewer/`) that turns a share link into the slideshow | any web host, or GitHub Pages — **must be HTTPS** |
| **The extension** | the toolbar button that *builds* links (and, optionally, opens received links natively) | your browser, loaded unpacked or from a signed file |

Every share link is `<your viewer URL>#<compressed collection>`. The list of
pages lives entirely in the `#…` fragment, which browsers never send to a
server — so the viewer is pure static files and there is no backend to run.

There is no store listing during the beta. Everything below is the
"without a store" path.

---

## Part 1 — Host the viewer

The files are in `viewer/` (source) or `dist/viewer/` (after `npm run build`).
They are identical apart from one baked-in default URL, which you override
anyway (Part 2), so either folder works. No build step, no server code.

### Option A — GitHub Pages

1. Fork or create a repo and put the contents of `viewer/` at a location Pages
   serves. Easiest: copy them to the **root of a `gh-pages` branch**, or keep
   them in `/docs` on `main`.
2. Repo **Settings → Pages** → set the source to that branch/folder.
3. Your viewer is now at `https://<user>.github.io/<repo>/`.

This repo already ships `.github/workflows/deploy-viewer.yml`, which deploys
`viewer/**` to Pages on every push — enable Pages with the "GitHub Actions"
source and it runs itself.

### Option B — Netlify / Cloudflare Pages / Vercel

Point the project at the `viewer/` directory (or upload `dist/viewer/`).
**No build command**, publish directory = that folder. Done.

### Option C — Your own web server

Upload the files (`index.html`, `tab-share.js`, `tab-share.css`,
`theme-init.js`, `frame-hosts.js`, `lib/`, `assets/`) anywhere that serves
static files over **HTTPS**:

```nginx
# nginx — nothing special needed
location /tab-share/ {
    alias /var/www/tab-share/;
    try_files $uri $uri/ =404;
}
```

The Content-Security-Policy is set inside `index.html`; you don't configure it
server-side. The only external request the viewer can make is one favicon per
domain from `icons.duckduckgo.com`, and only if a viewer leaves the "site
icons" option on — it is off by default.

### HTTPS is required

The extension refuses any viewer URL that isn't `https://` — **except**
`http://localhost` and `http://127.0.0.1`, which are allowed for testing.

### Test it locally first

```bash
npm run serve:viewer      # http://localhost:8777/
# then open  http://localhost:8777/#<a token>
```

or any static server (`npx serve viewer`, `python3 -m http.server -d viewer`).

---

## Part 2 — Build the extension for your viewer

Prerequisites: **Node 20+** and the system **`zip`** command. There are no npm
dependencies to install (`web-ext`, used only for Firefox packaging/linting, is
optional).

```bash
git clone https://github.com/kaikayy/multi-link-share
cd multi-link-share

# bake YOUR viewer URL into the build
VIEWER_BASE=https://you.example.com/tab-share/ npm run build
```

This produces:

```
dist/chrome/     unpacked extension for Chrome / Chromium / Brave / Edge / Opera / Vivaldi
dist/firefox/    unpacked extension for Firefox and forks
dist/viewer/     the static site, with your URL baked in
dist/*.zip       zipped copies of each
```

### Alternative: use the prebuilt extension and set the URL at runtime

If you don't want to build, grab the `dist/*.zip` from a
[Release](https://github.com/kaikayy/multi-link-share/releases), load it
(Part 3), then:

**Options page → "Viewer base URL" → paste your HTTPS URL → Save**, and approve
the one-time host-access prompt.

Setting it here (rather than baking it) is also what lets the "Open with Tab
Share" companion banner appear on your self-hosted viewer.

---

## Part 3 — Install the extension (no store)

Keep the `dist/chrome/` or `dist/firefox/` folder where it is — the browser
loads it **by path**. Moving or deleting it uninstalls the extension. There is
no auto-update: to move to a new version, rebuild and reload.

### Chrome, Chromium, Brave, Vivaldi, Opera, Edge — all the same

1. Open the extensions page:
   `chrome://extensions` · `brave://extensions` · `edge://extensions` ·
   `opera://extensions` · `vivaldi://extensions`
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the **`dist/chrome/`** folder.
4. Pin the toolbar icon.

- Works on Windows, macOS, and Linux identically.
- Chrome shows a *"Disable developer-mode extensions"* prompt on each start —
  click **Keep**. Brave/Edge/Vivaldi/Opera are quieter about it.
- Chrome no longer lets you install a `.crx` by drag-and-drop, so unpacked is
  the way. (`--load-extension=/path/to/dist/chrome` on the command line also
  works, and persists per shortcut.)

### Firefox and forks (LibreWolf, Waterfox, Zen, Mullvad, Floorp, ESR)

**Quick / temporary** — gone when you restart the browser:

1. `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on…** → pick **`dist/firefox/manifest.json`**.

**Permanent** needs a signed `.xpi`. Pick one:

- **Sign it through AMO (unlisted) — works on every Firefox:**
  ```bash
  # one free account at https://addons.mozilla.org, then create API credentials
  npx web-ext@8 sign --source-dir dist/firefox \
    --channel=unlisted \
    --api-key=user:XXXX --api-secret=YYYY
  ```
  Unlisted submissions are auto-reviewed (usually minutes). Install the
  resulting `.xpi` via `about:addons` → gear icon → **Install Add-on From
  File…**. No public store page is created.

- **Turn off signature enforcement** — only on **Developer Edition, Nightly,
  ESR, LibreWolf, Waterfox, Mullvad Browser** (regular Firefox Release/Beta
  ignore this):
  1. `about:config` → set `xpinstall.signatures.required` to **false**.
  2. Zip the *contents* of `dist/firefox/` (so `manifest.json` is at the zip
     root), rename to `tab-share.xpi`, and open it with the browser
     (or `about:addons` → Install Add-on From File).

     ```bash
     ( cd dist/firefox && zip -qr ../tab-share.xpi . )
     ```

- **Enterprise policy** (advanced, all channels): drop a `policies.json` with
  an `ExtensionSettings` → `installation_mode: "normal_installed"` entry
  pointing at the `.xpi` path. See Mozilla's policy docs.

The Firefox manifest already carries the add-on id
(`tab-share@multi-link-share`), which signing requires.

### Android

- **Firefox for Android** — supports extensions, but only ones **listed on
  AMO**, via a *custom add-on collection*:
  1. Submit the add-on to AMO as a **listed** extension (this does create a
     public page), or use an existing collection.
  2. Firefox Android → **Settings → About Firefox** → tap the logo 5× to unlock
     the debug menu → back to **Settings → Custom Add-on collection** → enter
     your AMO numeric user id and the collection name.
  3. Restart; the add-on appears under **Settings → Add-ons**.
  Unlisted/self-signed `.xpi`s do **not** work here.

- **Kiwi Browser** (Chromium on Android) — `kiwi://extensions` → Developer mode
  → **+ (from .zip/.crx)** → pick a zip of `dist/chrome/`. Kiwi is not actively
  maintained; treat it as best-effort.

### Safari (macOS / iOS)

Safari needs the extension repackaged as an app bundle:

```bash
xcrun safari-web-extension-converter dist/chrome/
```

This generates an Xcode project. Build and run it; on **macOS** you can then
enable it after ticking *Develop → Allow Unsigned Extensions*. On **iOS** you
need an Apple Developer account (or a 7-day free-provisioning sideload) to run
it on a device. See Apple's "Converting a web extension for Safari" guide. This
is a real porting task, not a quick load.

---

## Verify the round-trip

1. Click the toolbar button, pick a few tabs, **Create share link**.
2. The link should start with **your** viewer URL.
3. Open it in a second browser (or a private window) with no extension — you
   should get the slideshow.
4. Optional: open your browser's Network panel on the viewer — with site icons
   off it should make **zero** requests after the page and its own assets.

## Updating later

```bash
git pull
VIEWER_BASE=https://you.example.com/tab-share/ npm run build
```

Then redeploy `dist/viewer/` and, in the browser's extensions page, click the
**reload** icon on Tab Share (Chromium) or re-load the temporary add-on / install
the new signed `.xpi` (Firefox). Content scripts and the background worker do
**not** hot-reload — a rebuild on disk isn't picked up until you reload the
extension.

## Troubleshooting

| Symptom | Cause |
|---|---|
| "This viewer address must be https" when saving in options | non-HTTPS URL that isn't `localhost` |
| Links open a blank / "no pages" viewer | viewer files not deployed, or deployed at a different path than the URL you set |
| Share links point at `kaikayy.github.io` | you didn't set `VIEWER_BASE` at build time *and* didn't set the URL in options |
| "Open with Tab Share" banner never appears on your viewer | set the viewer URL in the **options page** (not just at build time) and approve the host prompt; then reload the extension |
| Firefox: "This add-on could not be installed because it has not been verified" | you're on Firefox Release/Beta — use AMO unlisted signing, or a channel that allows `xpinstall.signatures.required = false` |
| Chromium: extension vanishes after restart | the `dist/chrome/` folder was moved or deleted — reload unpacked from a stable path |

See also **`BUILD.md`** (dev workflow) and **`STORE-LISTING.md`** (the store
path, for later).
