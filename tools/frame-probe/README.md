# frame-probe

Rebuilds the GOOD / BAD host lists in `viewer/frame-hosts.js` from real HTTP
response headers.

```sh
# 1. probe every domain for X-Frame-Options / CSP frame-ancestors
node probe.mjs domains.txt results.json

# 2. (optional) probe a second batch, e.g. reference/docs sites
node probe.mjs domains2.txt results2.json

# 3. fold the results + the manual overrides into array literals
node build-lists.mjs > lists.txt
```

`probe.mjs` follows redirects with a desktop Chrome UA, records the final
`x-frame-options` and `content-security-policy: frame-ancestors`, and marks each
domain **good** (no anti-framing headers, 200), **bad** (headers block framing,
or a 401 auth wall), or **skip** (bot wall / 5xx / network error — can't tell).

`build-lists.mjs` reduces hosts to their registrable domain, applies the
`FORCE_BAD` / `DROP_GOOD` hand-review lists (SPAs, consent walls and CDN-edge
false negatives the header probe can't see), and prints the two arrays to paste
into `viewer/frame-hosts.js`.

Last run: 2026-08 — ~800 of the most-visited / most-shared domains.
