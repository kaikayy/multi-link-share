# Roadmap

Planned work, roughly ordered. Nothing here is committed to a release yet.

## Payload & link size

Done on `dev` (schema v4, `SCHEMA_VERSION = 4`):

- **Layered token** -- `[4, name, flags, urls[], ext?]`. The core is what the
  viewer needs to render; `ext` (`{ c: created, t: [titles] }`) is optional.
  `decode()` still reads v1/v2/v3, so every existing link opens unchanged.
- **"Minimal link" toggle** in the popup -- `encode(coll, { minimal: true })`
  drops `ext` whole (URLs only, roughly half the characters) and also strips
  tracking params from every URL: `utm_*`, `fbclid`, `gclid`, ~35 unambiguous
  ad/analytics names. Host, real query params and a shared URL's own `#fragment`
  are untouched; generic names (`si`, `ext`, `ref`) are left alone. A full
  (non-minimal) link never touches the URLs you gave it.

Still open:

- **Shared-domain table** when many pages share a host. LZString already
  compresses the repetition well, so this mostly helps pre-compression size and
  non-LZString consumers -- low priority, measure first.
- `www.` stripping -- **decided against.** Some hosts genuinely differ between
  `www` and apex; a broken redirect beats a few saved bytes.
- **Per-link title opt-in** finer than the all-or-nothing minimal toggle;
  optional long-title truncation.
- Revisit `MAX_PAGES` / `SOFT_URL_LIMIT`.
- Rollout: the viewer must carry the v4 decoder before v4 links go out (it is
  backward-compatible, so this is a safe forward step -- ship it to `main`'s
  viewer first).

## First-party link shortener

Built and shipping in its own repo:
[tab-share-shortener](https://github.com/kaikayy/tab-share-shortener) (AGPL-3.0).

Done:

- Dedicated, self-hostable service. Architecture chosen: **shortens the long
  fragment link** (302 / meta-refresh), no viewer changes, recipient still makes
  zero requests. Free, no account, opt-in per link.
- Node zero-dep + a Cloudflare Worker port. Storage: JSON file or `node:sqlite`.
  Linux + Windows installers.
- Host-allowlisted (only shortens links to your own viewer). Optional expiry
  (30-day default TTL + a `keepToken` to pin), identical-link dedup, 1 MB size
  limit. The extension `POST`s the link so a proxy request-line limit never
  bites.
- Built-in **"Tab Share shortener (recommended)"** provider in the extension
  options, with a *Normal / Readable words* style toggle. Off by default,
  alongside the custom-endpoint option
  ([docs/CUSTOM-SHORTENER.md](docs/CUSTOM-SHORTENER.md)). The address is
  pre-filled with `s.kaikay.de` and the option is labelled *recommended*.
- **Public deployment live at `s.kaikay.de`.** Runs as a `systemctl --user`
  service (JSON store) behind Apache reverse proxy + Let's Encrypt on a KeyHelp
  box; allow-lists `kaikayy.github.io` only. The default viewer + this shortener
  work with no configuration (still Off until the user turns it on).
- **Admin panel** at `s.kaikay.de/admin` (token-gated): link table, revoke /
  bulk revoke-delete, allowlist editor, redirect analytics, `/admin/metrics`.

Still open:

- Move the `s.kaikay.de` instance to a durable backend + backups. `node:sqlite`
  needs Node 22.5+ (box is on 20); a MySQL/MariaDB backend is on the shortener
  repo's roadmap and is the more likely path for a KeyHelp box. Small
  `HEAD`-request fix in the shortener (returns 405 today).
- Letting other people route their own self-hosted viewers through `s.kaikay.de`
  -- via the allowlist-request issue form the shortener repo already ships -- is
  a later step, once the verification workflow is settled. Self-hosters can
  already do all of this on their own instance today.

Decided against: a server-side collection store (would shrink stored rows and
allow editing a shared collection, but the recipient would have to fetch the
collection from the server on open -- that breaks the zero-request / serverless
property, which stays. Shortener keeps only the long URL + code.)

## Safer-links filter

- Warn the recipient before opening pages on a known **malware / phishing /
  adult / gambling** blocklist (public pi-hole-style lists, e.g.
  [hagezi/dns-blocklists](https://github.com/hagezi/dns-blocklists)).
- **Fully offline** -- bundle a compact hashed set (Bloom filter or
  truncated-hash set), refreshed at build time. No reputation-service calls.
- On decode, flag matching pages and show an interstitial
  ("This link contains N pages flagged as ...") instead of previewing or
  auto-opening them. The sender sees the same flags in the popup.
- Categories toggleable in the viewer's settings menu. **Warn only, never
  block** -- the link only ever contains URLs the user could type themselves.

## Link expiry (client-side) -- opt-in, lower priority

The **shortener** already does expiry server-side (30-day default TTL, a
`keepToken` to pin, keep/expire controls in the admin panel -- shortener 0.3.0).
For anyone using the shortener that covers "my links shouldn't pile up forever".

A client-side `expires` field stamped into the token is a different thing, and
one the **sharer** opts into per link: it makes a **plain fragment link** (no
shortener) show an "expired" state past a chosen date, so you can share something
time-limited without running anything. It is **soft** -- the URLs are in the link,
a determined recipient can read them off or edit the token -- so it is a courtesy
signal ("I meant this to lapse"), not access control. That is a reasonable thing
to offer at the sharer's discretion; it just ranks below payload size and the
safer-links filter.

- Optional "expires in N days" chosen at creation; the viewer shows an "expired"
  state instead of rendering. Rides in schema v4's `ext` blob, so a minimal link
  never carries it.
- "Permanent" / password-only variants behind a dev flag until the behaviour is
  settled.

## Viewer & popup

- **Drag-to-reorder** in the popup list (currently ▲/▼ buttons).
- **Remember the last-used view per collection** (currently always opens
  Slideshow).
- **"Copy as Markdown list"** in the viewer's List view.
- Per-collection metadata surfaced when the extension is installed (notes,
  tags) -- read from `ext` in schema v4.
- Keyboard shortcut to jump straight to a page number.

## Self-hosted viewer

The viewer is static files today (`viewer/`, hosted anywhere). **The shipped
default stays `kaikayy.github.io`** -- that's the "hits no server you don't
already trust, makes zero requests" promise, and it doesn't change just
because a domain exists. A `kaikay.de`-hosted viewer (apex or `tabs.kaikay.de`)
is an *optional* alternative to work out later on `dev`, not a replacement.

Two ideas for people who want to run a fuller instance (whether that's
`kaikay.de` once the server's up, or anyone else):

- **Single-file executable** -- bundle the viewer + a tiny static server into one
  binary per OS (e.g. Node SEA, `deno compile`, or Bun), so self-hosting is
  "download, run, done" with no web server to configure. HTTPS still needs a
  proxy or a bundled cert helper.
- **Admin / dashboard panel** -- a small authenticated UI showing collections
  opened through this viewer, per-link stats, and (paired with the first-party
  shortener on the same box, i.e. `s.kaikay.de`) the shortener's link table:
  search, hit counts, expiry, revoke a code. Opt-in; the default viewer stays
  zero-knowledge and serverless. Depends on the shortener deploy above (same
  server, same blocker: pending access).
- **Safer-links filter** (see its own section) lives in the viewer -- surface its
  toggles and any per-instance blocklist config in this same panel.

## Platform

- The **viewer already works on mobile** (responsive, swipe nav, no extension
  needed) -- that's the recipient side and it's done.
- **The extension on Firefox for Android.** Blocked by `tabGroups` being a
  *required* permission (Android Firefox has no tab-groups API) and
  `strict_min_version: 139`. The popup already degrades gracefully when the API
  is missing (`hasTabGroupsApi()`), so the fix is: make `tabGroups` optional
  (request it from the popup/options instead of relying on it at content-script
  time), test the popup at ~360 px, and flag Android compatibility on AMO. Low
  priority -- link *creation* is a desktop task.
- Investigate Safari packaging beyond the manual `safari-web-extension-converter`
  step.

## Done (previously on this list)

- ✅ Password-protected links (client-side WebCrypto).
- ✅ Optional external URL shorteners (is.gd / v.gd / TinyURL / custom).
- ✅ Companion "Open with Tab Share" import button for recipients who have the
  extension.
- ✅ Self-hosting the viewer + a custom viewer URL in options.
- ✅ `frame-hosts.js` generated from a live header probe instead of a hand list.
- ✅ Multi-window source, per-view search, selection mode, light/dark, popup
  persistence.
