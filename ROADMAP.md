# Roadmap

Planned work, roughly ordered. Nothing here is committed to a release yet.

## Payload & link size

- **Schema v4 -- layered payload.** Split the token into a required core
  (`[4, name, flags, urls[]]`) and an optional trailing `ext` blob (titles,
  per-page notes, reading order, folder/group structure). The viewer and the
  extension read `ext` when present; omitting it produces a smaller link.
- **"Minimal link" toggle** at creation -- drops `ext` and the `created`
  timestamp, URLs only.
- **URL slimming** -- strip `www.`, strip common tracking params
  (`utm_*`, `fbclid`, ...), and use a shared-domain table when many pages share a
  host.
- **Title handling** -- titles become opt-in per link (the viewer already falls
  back to host/URL); optionally truncate long titles.
- Revisit `MAX_PAGES` / `SOFT_URL_LIMIT` once v4 lands.

## First-party link shortener

Built and shipping in its own repo:
[tab-share-shortener](https://github.com/kaikayy/tab-share-shortener) (AGPL-3.0).

Done:

- Dedicated, self-hostable service. Architecture chosen: **shortens the long
  fragment link** (302 / meta-refresh), no viewer changes, recipient still makes
  zero requests. Free, no account, opt-in per link.
- Node zero-dep + a Cloudflare Worker port. Storage: JSON file or `node:sqlite`.
  Linux + Windows installers.
- Host-allowlisted (only shortens links to your own viewer). Optional expiry,
  identical-link dedup, clean size limits (256 KB).
- Built-in **"Tab Share shortener"** provider in the extension options, with a
  *Normal / Readable words* style toggle. Off by default, alongside the
  custom-endpoint option ([docs/CUSTOM-SHORTENER.md](docs/CUSTOM-SHORTENER.md)).

Still open:

- Make it *the recommended* option (not just available) once there's a public
  deployment.

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

## Link expiry

- Optional "expires in N days" stamped into the token (proposed default 14).
  The viewer refuses to render an expired collection.
- Purely client-side -- `created` is already in the schema; this adds an
  `expires` field and a check.
- "Permanent" and password-only variants stay behind an experimental/dev flag
  until the behaviour is settled.

## Viewer & popup

- **Drag-to-reorder** in the popup list (currently ▲/▼ buttons).
- **Remember the last-used view per collection** (currently always opens
  Slideshow).
- **"Copy as Markdown list"** in the viewer's List view.
- Per-collection metadata surfaced when the extension is installed (notes,
  tags) -- read from `ext` in schema v4.
- Keyboard shortcut to jump straight to a page number.

## Self-hosted viewer

The viewer is static files today (`viewer/`, hosted anywhere). Two ideas for
people who want to run a fuller instance:

- **Single-file executable** -- bundle the viewer + a tiny static server into one
  binary per OS (e.g. Node SEA, `deno compile`, or Bun), so self-hosting is
  "download, run, done" with no web server to configure. HTTPS still needs a
  proxy or a bundled cert helper.
- **Admin / dashboard panel** for a self-hosted instance -- a small authenticated
  UI showing collections opened through this viewer, per-link stats, and (if
  paired with the first-party shortener on the same box) the shortener's link
  table: search, hit counts, expiry, revoke a code. Opt-in; the default viewer
  stays zero-knowledge and serverless.
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
