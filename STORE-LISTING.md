# Store listing copy & submission notes

Reusable text for the Chrome Web Store and Firefox AMO dashboards, plus the
permission justifications reviewers ask for.

---

## Name

Tab Share — one link for a group of tabs

## Summary (Chrome: 132 chars max)

Turn the current window, a tab group, or a list of links into one shareable
link that opens as a slideshow. No account, no server.

## Description

Tab Share bundles a set of pages into a single link.

• Share the current window, a browser tab group, or links you paste in.
• Reorder and trim the list before you create the link.
• The recipient just clicks the link — no extension, no sign-up. It opens as a
  clean slideshow: framed page view, title bar, next/previous arrows, and a
  "3 / 12" counter. There's also a grid overview and an "open all in tabs"
  button.
• Four ways to view a link: slideshow, grid, a copyable numbered list, and a
  large preview grid. Sites that allow it preview live; the rest show a card.
• Optional: protect a link with a password (encrypted in your browser), or run
  it through a URL shortener you choose.
• If the recipient also has Tab Share, the viewer offers to open the whole set
  straight into a window or tab group, or save it to their history.

How it works — and why it's private:
The whole list is packed into the part of the link after "#", which browsers
never send to a server. There is no backend, no database, and no tracking. The
extension makes no network requests unless you turn on a URL shortener; the
viewer makes none unless you leave site icons on. It reads your tabs only when
you press a button.

You host the tiny viewer page yourself (GitHub Pages, Netlify, …) or use the
one configured by whoever packaged the extension. Open source (GNU AGPL-3.0).

## Category

Productivity

## Screenshots

`assets/screenshot-1-popup.png` (the popup), `assets/screenshot-2-viewer.png`
(the slideshow viewer) — real 1280×800 captures of the built extension.

## Chrome promo tile

`assets/promo-440x280.png`

---

## Permission justifications

### `tabs` (required)

Reads the URL and title of tabs **in the current window**, and only when the
user clicks "Create share link" or one of the "add this window's tabs" buttons.
Used to populate the list of pages the user chooses from. On import (see the
content script below) it also opens the shared pages into tabs/windows the user
asked for. The data never leaves the device except inside the share link the
user explicitly creates.

### `tabGroups` (required)

Reads tab group names and colours for the "Tab group" source and to name a
collection after its group; creates and titles a group when the user picks
"Tab group" on the import banner. Required because a content script cannot
request an optional permission at runtime, which made the import action fail.

### `storage` (required)

`storage.local` only. Stores the user's viewer URL, setup choices, and up to 50
recently created links, on the device. Not synced, not transmitted.

### `scripting` (required)

Used only to register the single content script (below) for a viewer address
the user sets in the options page that isn't the packaged default — a
self-hosted viewer, or `localhost` for testing. The script is registered only
after the user approves that one host, and unregistered if the address changes.

### `content_scripts` — viewer page only

The static entry matches **only the packaged viewer host**
(`https://kaikayy.github.io/multi-link-share/*`). It reads the current page's
URL fragment; if it decodes to a Tab Share collection it shows an in-page banner
offering to open the pages into a window or tab group, or save the collection to
the user's on-device history. The banner UI lives in a closed shadow root and
acts only on genuine user clicks. It is not registered for, and does not run on,
any other site. No remote code, no network requests.

### `optional_host_permissions` (`*://*/*`, opt-in)

Never requested at install, and the wildcard is never requested. When the user
saves a viewer address other than the packaged default, the options page
requests host access to **that one origin** so the content script above can be
registered there; nothing else uses it.

### Background service worker

Event-driven, no persistent state of its own. Handles the import-banner actions
(open pages / save to history) and keeps the custom-host content script
registration in sync with the saved viewer address. No network access.

### Network requests

The extension makes none, unless the user turns on a URL shortener in options
(is.gd / v.gd / TinyURL / a custom endpoint) — then creating a link POSTs that
one generated URL to the chosen service. The viewer makes none, unless the
"site icons" option is left on — then it fetches one icon per domain from
`icons.duckduckgo.com` when a link is opened. Both are user-visible toggles.

### Password protection

Optional. When set, the collection is encrypted client-side (WebCrypto:
PBKDF2-SHA-256 → AES-256-GCM) before it goes in the link fragment. The password
is never stored or transmitted.

### Remote code

None. The single third-party library (lz-string, MIT) is bundled in the
package. See THIRD-PARTY.md.

### Data collection

None. (Firefox manifest declares
`browser_specific_settings.gecko.data_collection_permissions.required = ["none"]`.)

---

## AMO (Firefox) submission notes

- Upload `dist/tab-share-firefox-v<version>.zip`.
- This add-on **vendors a minified library** (`src/lib/lzstring.min.js`), so AMO
  will ask for source. Upload `dist/tab-share-source-v<version>.zip`
  (`npm run zip:source`).
- Reviewer notes to paste:
  > Build: `npm install` (no dependencies) then `npm run build`; the add-on is
  > `dist/firefox/`. `src/lib/lzstring.min.js` is lz-string 1.5.0, copied
  > verbatim from
  > https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.5.0/lz-string.min.js
  > All other files are the original source, unminified. No remote code. The
  > only outbound request is an optional, off-by-default URL shortener the user
  > configures in options. One content script (`src/content/import-banner.js`)
  > runs only on the configured viewer page; the background worker
  > (`src/background.js`) is offline and event-driven.

## Chrome Web Store submission notes

- Upload `dist/tab-share-chrome-v<version>.zip`.
- Single purpose: "Create one shareable link from a group of tabs and view
  shared links as a slideshow."
- Data usage: check **none**; the privacy policy URL is
  `https://kaikayy.github.io/multi-link-share/privacy.html` (deployed from
  `viewer/privacy.html`, mirrors `PRIVACY.md`).
- Fill the permission justifications from the section above.
