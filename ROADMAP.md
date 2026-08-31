# Roadmap

Planned work, roughly ordered. Nothing here is committed to a release yet.

## Payload & link size

- **Schema v4 — layered payload.** Split the token into a required core
  (`[4, name, flags, urls[]]`) and an optional trailing `ext` blob (titles,
  per-page notes, reading order, folder/group structure). The viewer and the
  extension read `ext` when present; omitting it produces a smaller link.
- **"Minimal link" toggle** at creation — drops `ext` and the `created`
  timestamp, URLs only.
- **URL slimming** — strip `www.`, strip common tracking params
  (`utm_*`, `fbclid`, …), and use a shared-domain table when many pages share a
  host.
- **Title handling** — titles become opt-in per link (the viewer already falls
  back to host/URL); optionally truncate long titles.
- Revisit `MAX_PAGES` / `SOFT_URL_LIMIT` once v4 lands.

## Optional short-link backend

- An **optional, self-hostable** service that stores a collection under a short
  code, so the shared link can be a few characters instead of a fragment.
- **Free for everyone, no account.** Strictly opt-in per link — the default
  stays the fully self-contained fragment link with no server involved.
- Minimal data model (collection blob + code + optional expiry). Document
  exactly what it stores; self-hosters run their own instance and point the
  extension at it (same mechanism as the custom viewer URL).
- Ships alongside the existing external-shortener option, not replacing it.
  (External shorteners shorten the long fragment link via a third party; this
  stores the collection itself.)

## Safer-links filter

- Warn the recipient before opening pages on a known **malware / phishing /
  adult / gambling** blocklist (public pi-hole-style lists, e.g.
  [hagezi/dns-blocklists](https://github.com/hagezi/dns-blocklists)).
- **Fully offline** — bundle a compact hashed set (Bloom filter or
  truncated-hash set), refreshed at build time. No reputation-service calls.
- On decode, flag matching pages and show an interstitial
  ("This link contains N pages flagged as …") instead of previewing or
  auto-opening them. The sender sees the same flags in the popup.
- Categories toggleable in the viewer's settings menu. **Warn only, never
  block** — the link only ever contains URLs the user could type themselves.

## Link expiry

- Optional "expires in N days" stamped into the token (proposed default 14).
  The viewer refuses to render an expired collection.
- Purely client-side — `created` is already in the schema; this adds an
  `expires` field and a check.
- "Permanent" and password-only variants stay behind an experimental/dev flag
  until the behaviour is settled.

## Viewer & popup

- **Drag-to-reorder** in the popup list (currently ▲/▼ buttons).
- **Remember the last-used view per collection** (currently always opens
  Slideshow).
- **"Copy as Markdown list"** in the viewer's List view.
- Per-collection metadata surfaced when the extension is installed (notes,
  tags) — read from `ext` in schema v4.
- Keyboard shortcut to jump straight to a page number.

## Platform

- **Firefox for Android** once an AMO listing exists (custom add-on
  collection).
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
