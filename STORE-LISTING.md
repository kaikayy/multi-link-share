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

How it works — and why it's private:
The whole list is packed into the part of the link after "#", which browsers
never send to a server. There is no backend, no database, and no tracking. The
extension makes zero network requests. It reads your tabs only when you press
the button, and asks for the bare minimum permissions.

You host the tiny viewer page yourself (GitHub Pages, Netlify, …) or use the
one configured by whoever packaged the extension. Open source (MIT).

## Category

Productivity

## Screenshots

`assets/screenshot-1-popup.png`, `assets/screenshot-2-viewer.png`
(1280×800). Replace with real captures from your build before publishing —
the checked-in files are representative mockups.

## Chrome promo tile

`assets/promo-440x280.png`

---

## Permission justifications

### `tabs` (required)

Reads the URL and title of tabs **in the current window**, and only when the
user clicks "Create share link" or "Add this window's tabs". Used to populate
the list of pages the user chooses from. The data never leaves the device
except inside the share link the user explicitly creates. No content scripts,
no host permissions, no background page.

### `tabGroups` (optional)

Requested at runtime, only if the user opens the "Tab group" tab. Reads tab
group titles so the collection can be named after the group and the group
picker can be shown. Declined by default; the rest of the extension works
without it.

### `storage` (required)

`storage.local` only. Stores the user's chosen viewer URL and up to 8 recently
created links, on the device. Not synced, not transmitted.

### No host permissions

The extension declares no `host_permissions` and injects no scripts into web
pages.

### Remote code

None. The single third-party library (lz-string, MIT) is bundled in the
package. See THIRD-PARTY.md.

### Data collection

None. (Firefox manifest declares
`browser_specific_settings.gecko.data_collection_permissions.required = ["none"]`.)

---

## AMO (Firefox) submission notes

- Upload `dist/tab-share-firefox-v<version>.zip`.
- This add-on **vendors a minified library** (`lib/lzstring.min.js`), so AMO
  will ask for source. Upload `dist/tab-share-source-v<version>.zip`
  (`npm run zip:source`).
- Reviewer notes to paste:
  > Build: `npm install` (no dependencies) then `npm run build`; the add-on is
  > `dist/firefox/`. `lib/lzstring.min.js` is lz-string 1.5.0, copied verbatim
  > from https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.5.0/lz-string.min.js
  > All other files are the original source, unminified. No network requests,
  > no remote code, no content scripts.

## Chrome Web Store submission notes

- Upload `dist/tab-share-chrome-v<version>.zip`.
- Single purpose: "Create one shareable link from a group of tabs and view
  shared links as a slideshow."
- Data usage: check **none**; the privacy policy URL is your hosted copy of
  `PRIVACY.md`.
- Fill the permission justifications from the section above.
