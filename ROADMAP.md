# Roadmap

Planned, not yet built. Order is rough priority, not a schedule.

## Safer-links filter (planned)

Warn the recipient before opening a page that's on a known **malicious,
phishing, adult, or gambling** blocklist. The viewer would:

- ship a compact, bundled set of blocklist hashes (built from public
  [pi-hole-style lists](https://github.com/hagezi/dns-blocklists) — malware /
  phishing / NSFW / gambling categories), refreshed at build time;
- on decode, flag any page whose host matches, and show an interstitial
  ("This link contains N pages flagged as …") instead of previewing or
  auto-opening them;
- keep it **fully offline** — hash lookups against the bundled set, no calls to
  a reputation service;
- let the sender see the same flags in the popup before they create the link.

Design notes: keep the bundle small (Bloom filter or truncated-hash set),
categories toggleable in the viewer's ⚙ menu, and never *block* — only warn,
since the link still just contains URLs the user could type themselves.

## Link expiry (planned, dev-branch)

An optional "expires in N days" stamped into the token (default 14). The viewer
refuses to render an expired collection. "Permanent" and password-only links
stay on a dev/paid branch. Purely client-side — the timestamp is already in the
schema (`created`), this just adds an `expires` field and a check.

## Smaller items

- Firefox Android support once an AMO listing exists (custom add-on collection).
- Drag-to-reorder in the popup list (currently ▲/▼ buttons).
- A "copy as Markdown list" option in the viewer's List view.
- Remember the last-used view per-collection (currently always opens Slideshow).

## Done (was on this list)

- ✅ Password-protected links (client-side WebCrypto).
- ✅ Optional external URL shorteners (is.gd / v.gd / TinyURL / custom).
- ✅ Self-hosting the viewer + a custom viewer URL in options.
- ✅ `frame-hosts.js` from a live header probe instead of a hand list.
