# 10: Replace non-ASCII punctuation in code and comments

**What to build:** CONTRIBUTING.md's coding conventions require ASCII punctuation only, but code and comments throughout the extension, viewer, shared modules and scripts use em-dashes, arrows, ellipses, middle dots and check marks. Replace them with ASCII equivalents in code and comments. Leave user-facing translation strings alone unless the maintainer decides the rule covers them (ask before changing UI text). Fix unclear short names you touch along the way (e.g. single-letter or abbreviated identifiers) if it's cheap.

Do this after the functional tickets so it doesn't create merge conflicts with them.

**Blocked by:** 01, 02, 03, 04, 05, 06, 07, 08

**Status:** done (HTML fallback/privacy page text and i18n strings left for the maintainer)

- [x] No non-ASCII punctuation remains in code or comments outside the i18n string tables and vendored files
- [x] Any non-ASCII characters that appear in UI output from code (e.g. a separator glyph) are either moved into i18n strings or replaced deliberately
- [x] `shared/` copies are re-synced and `npm test` passes
