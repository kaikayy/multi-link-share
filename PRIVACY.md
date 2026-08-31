# Privacy Policy — Tab Share

_Last updated: 2026-08-31_

Tab Share is built so that there is nothing to collect.

## What the extension accesses

- **Open tabs in the current window** — their URLs and titles. Read only at the
  moment you click **Create share link** (or **+ Add this window's tabs**), only
  for the window you triggered it from, and only to build the list you see in
  the popup.
- **Tab group names** — only if you grant the optional `tabGroups` permission,
  and only to label the collection and populate the group picker.
- **Local extension storage** — your chosen "viewer address" and a list of up to
  8 links you recently generated, stored on your device via the browser's
  `storage.local`. Never synced, never transmitted. Clear it any time from the
  options page.

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

## Contact

Open an issue at https://github.com/kaikayy/multi-link-share/issues.
