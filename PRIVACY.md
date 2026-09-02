# Privacy Policy -- Tab Share

_Last updated: 2026-09-02 (1.0.0-beta.7.5)_

Tab Share is built so that there is nothing to collect. **The extension and the
viewer** have no server, no account, no analytics, and no tracking. The one
part with a server is the **optional URL shortener** -- off by default, and
covered in its own section below.

## What the extension accesses

- **Open tabs in the current window** -- their URLs, titles and icons. Read only
  at the moment you click **Create share link** (or an "add tabs" button), only
  for the window you triggered it from, and only to build the list you choose
  from. Tab icons are shown in the popup and never uploaded.
- **Tab groups** -- names and colours, and (on import) the ability to create a
  group. Used for the "Tab group" source and the "open as a tab group" action.
- **Local extension storage** (`storage.local`) -- your viewer address, your
  setup choices, and up to 50 recently created links, on this device. Never
  synced, never transmitted. Clear all or individual entries in the options
  page.
- **The viewer page only** -- one content script runs on the slideshow viewer
  page. It reads the collection from that page's URL fragment so it can add an
  "Open with Tab Share" button that opens the pages with the extension instead
  of the web view. It ships enabled only for the packaged viewer address; a
  self-hosted (https) viewer runs it only after you approve that one host in
  the options page. It runs on no other site.

## What can make a network request -- and only if you turn it on

- **Site icons** in the shared viewer. If left on, when a recipient opens a link
  the viewer requests one icon per domain in the collection from
  `icons.duckduckgo.com`. Those domain names go to DuckDuckGo's icon service and
  nowhere else. Turn it off at first run or in options, and the viewer makes
  **zero** network requests.
- **A URL shortener**. Off by default. The built-in choices are the first-party
  **Tab Share shortener** (`s.kaikay.de`), **da.gd**, **TinyURL**, or a **custom
  endpoint** you supply. When one is on, creating a share link sends that one
  generated URL to the service you picked -- and nothing else. What the service
  then does with it (including whether it counts clicks) is up to its operator;
  for the first-party one, see *The Tab Share shortener* below.

Everything else -- the extension itself, the viewer with icons off -- makes no
network requests at all.

## The Tab Share shortener (`s.kaikay.de`)

`s.kaikay.de` is a small service run by the Tab Share author. It is also
[self-hostable](https://github.com/kaikayy/tab-share-shortener); if you run your
own instance, everything below is yours to configure or switch off.

Using it is opt-in: you choose *Tab Share shortener* in **Options -> Shorten
links** and turn it on. Then, and only then:

- **When you create a short link**, the extension sends the one full share link
  to `s.kaikay.de`, which stores it (the long viewer URL, keyed by the short
  code) so the short link can redirect to it later. That long URL contains every
  page URL and title in the collection, in its `#` fragment. Any shortener has
  to store its links' destinations, so the operator *can* read them; the
  admin panel only shows the target host until a destination is deliberately
  revealed one link at a time, and making an instance where the operator
  genuinely cannot read them is [on the shortener's roadmap](https://github.com/kaikayy/tab-share-shortener/blob/main/ROADMAP.md).
  The default (no shortener) sends the link to no one.
- **When someone opens a short link**, the server keeps aggregate day-level
  counters only: a per-link **hit count**, a tally of the **host that referred
  the click** (e.g. `news.ycombinator.com`), and a tally of the visitor's
  **browser family and major version** (e.g. `Firefox 130`) reduced from the
  User-Agent. It does **not** keep your **IP address**, geolocation, the full
  referring URL or page path, the full User-Agent or OS/device, any **cookie**,
  or any per-visitor identifier or fingerprint. Kept ~365 days, visible only to
  the operator through a password-gated admin page. The operator can also, on
  request, see an aggregate histogram of the *domains* people bundle
  (`reddit.com`, never the specific page) -- computed on the spot, stored
  nowhere.
- It runs **no third-party analytics, advertising, or tracking code**, and
  **none of it is ever sold or shared** for advertising or marketing --
  see the shortener's [privacy policy](https://github.com/kaikayy/tab-share-shortener/blob/main/PRIVACY.md).

On your own instance the click analytics are off with `SHORTENER_ANALYTICS=0`
and the hit counter with `SHORTENER_COUNT_HITS=0`.

## The share link

The selected page URLs and titles are compressed and placed in the **fragment**
of the link -- the part after `#`. Per web standards, browsers do **not** send
the fragment to any server. The link is readable by anyone you give it to (and
by anyone they forward it to), so treat it like the list of pages it contains.

## Password-protected links

When you set a password, the collection is **encrypted in your browser**
(PBKDF2-SHA-256, 210 000 iterations -> AES-256-GCM) before it goes in the link.
The password is never stored and never transmitted. The recipient types it into
the viewer to decrypt locally. **If the password is lost, the link cannot be
opened** -- there is no recovery, and history entries for password links still
need the password.

## The viewer page

The viewer is a static file (no backend). It reads the collection from the
fragment in the recipient's browser and renders it. "Open all pages" and the
live preview simply navigate to, or embed, the pages you chose -- the same as
clicking the links yourself. If the recipient also has Tab Share, an
"Open with Tab Share" button offers to open the collection into a window or tab
group, or save it to their own on-device history -- that choice never leaves
their device.

## Contact

Open an issue at https://github.com/kaikayy/multi-link-share/issues.
