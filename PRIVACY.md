# Privacy Policy — Tab Share

_Last updated: 2026-08-31_

Tab Share is built so that there is nothing to collect.

## What the extension accesses

- **Open tabs in the current window** — their URLs and titles. Read only at the
  moment you click **Create share link** (or one of the "add this window's tabs"
  buttons), only for the window you triggered it from, and only to build the
  list you see in the popup.
- **Tab group names** — only if you grant the optional `tabGroups` permission,
  and only to label the collection, populate the group picker, and (on import)
  name a group it creates for you.
- **Local extension storage** — your chosen "viewer address" and a list of up to
  50 links you recently generated, stored on your device via the browser's
  `storage.local`. Never synced, never transmitted. Clear all or individual
  entries any time from the options page.
- **The viewer page only** — one content script runs on the slideshow viewer
  page. It reads the collection from that page's URL fragment so it can offer to
  open the pages with the extension instead of the web view. It ships enabled
  only for the packaged viewer address; if you point the extension at your own
  viewer (including `localhost` for testing), the options page asks you to
  approve that one host before the script runs there. It runs on no other site.

## What is sent over the network

Nothing. The extension makes no network requests. It has no server, no
analytics, no telemetry, no accounts.

## The share link

When you create a link, the selected page URLs and titles are compressed and
placed in the **fragment** of the link — the part after the `#`. Per web
standards, browsers do **not** send the fragment to any server. The link is
readable by anyone you give it to (and by anyone they forward it to), so treat
it like the list of pages it contains.

## The viewer page

The recipient opens the link in a normal browser tab. The viewer page is a
static file (no backend). It reads the collection from the fragment in the
recipient's browser and renders it. It loads no third-party scripts, fonts, or
images and sends no data anywhere. "Open all" and "live preview" simply
navigate to, or embed, the pages you chose — the same as clicking the links
yourself.

If the recipient also has Tab Share installed, the content script described
above adds an in-page banner offering to open the collection into a window or a
tab group, or to save it to the recipient's own on-device history. That choice,
and the pages opened, never leave the recipient's device.

## Contact

Open an issue at https://github.com/kaikayy/multi-link-share/issues.
