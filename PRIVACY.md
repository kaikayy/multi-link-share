# Privacy Policy — Tab Share

_Last updated: 2026-08-31_

Tab Share is built so that there is nothing to collect. It has no server, no
account, no analytics, and no tracking.

## What the extension accesses

- **Open tabs in the current window** — their URLs, titles and icons. Read only
  at the moment you click **Create share link** (or an "add tabs" button), only
  for the window you triggered it from, and only to build the list you choose
  from. Tab icons are shown in the popup and never uploaded.
- **Tab groups** — names and colours, and (on import) the ability to create a
  group. Used for the "Tab group" source and the "open as a tab group" action.
- **Local extension storage** (`storage.local`) — your viewer address, your
  setup choices, and up to 50 recently created links, on this device. Never
  synced, never transmitted. Clear all or individual entries in the options
  page.
- **The viewer page only** — one content script runs on the slideshow viewer
  page. It reads the collection from that page's URL fragment so it can add an
  "Open with Tab Share" button that opens the pages with the extension instead
  of the web view. It ships enabled only for the packaged viewer address; a
  self-hosted viewer (or `localhost`) runs it only after you approve that one
  host in the options page. It runs on no other site.

## What can make a network request — and only if you turn it on

- **Site icons** in the shared viewer. If left on, when a recipient opens a link
  the viewer requests one icon per domain in the collection from
  `icons.duckduckgo.com`. Those domain names go to DuckDuckGo's icon service and
  nowhere else. Turn it off at first run or in options, and the viewer makes
  **zero** network requests.
- **A URL shortener**. Off by default. If you pick one (is.gd / v.gd / TinyURL /
  your own endpoint), creating a link sends that one generated URL to the
  service you chose.

Everything else — the extension itself, the viewer with icons off — makes no
network requests at all.

## The share link

The selected page URLs and titles are compressed and placed in the **fragment**
of the link — the part after `#`. Per web standards, browsers do **not** send
the fragment to any server. The link is readable by anyone you give it to (and
by anyone they forward it to), so treat it like the list of pages it contains.

## Password-protected links

When you set a password, the collection is **encrypted in your browser**
(PBKDF2-SHA-256, 210 000 iterations → AES-256-GCM) before it goes in the link.
The password is never stored and never transmitted. The recipient types it into
the viewer to decrypt locally. **If the password is lost, the link cannot be
opened** — there is no recovery, and history entries for password links still
need the password.

## The viewer page

The viewer is a static file (no backend). It reads the collection from the
fragment in the recipient's browser and renders it. "Open all pages" and the
live preview simply navigate to, or embed, the pages you chose — the same as
clicking the links yourself. If the recipient also has Tab Share, an
"Open with Tab Share" button offers to open the collection into a window or tab
group, or save it to their own on-device history — that choice never leaves
their device.

## Contact

Open an issue at https://github.com/kaikayy/multi-link-share/issues.
