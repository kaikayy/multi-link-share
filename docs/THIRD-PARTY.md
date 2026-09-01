# Third-party code

## lz-string 1.5.0

- **Files:** `shared/lzstring.min.js` (and the copies synced into
  `extension/src/lib/` and `viewer/lib/`)
- **Source:** https://github.com/pieroxy/lz-string
- **Version:** 1.5.0, fetched unmodified from
  `https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.5.0/lz-string.min.js`
- **License:** MIT

Used to compress the tab collection so it fits comfortably in a URL fragment.
It is the only third-party dependency and it is vendored (not loaded from a
CDN at runtime) so the extension ships no remote code.

The unminified source is available at the URL above; for AMO review, the
minified file is byte-identical to cdnjs's published 1.5.0 build.

Everything else in this repository is original and licensed under the GNU
AGPL-3.0 (see `LICENSE`). Bundling the MIT-licensed lz-string inside an
AGPL-licensed work is permitted; lz-string keeps its own license and attribution.
