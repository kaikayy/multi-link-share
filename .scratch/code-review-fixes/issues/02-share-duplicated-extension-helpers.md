# 02: Share one copy of the helpers the popup, options page and background each define separately

**What to build:** Prefactor. Several small pieces of logic are copied between the popup, the options page, the background worker and the viewer: the list of built-in viewer hosts, normalising a shortener base URL (stripping trailing slashes), the "is this a localhost address we may request permission for" check, and the toast notification helper. Give each a single home (the canonical `shared/` module for anything used by both extension and viewer; an extension-local module otherwise) and have every caller use it. No user-visible behaviour changes.

Remember `shared/` is canonical and is copied out by the sync script; edit the canonical file and re-sync, never the copies.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] The built-in viewer host list is defined once and read by every script that needs it (manifests may still list hosts statically if the build can't template them; note this if so)
- [x] Shortener base normalisation, the localhost check and the toast helper each exist once
- [x] Popup, options page and viewer still show toasts, accept localhost/custom shortener settings and recognise built-in viewers exactly as before
- [x] Synced copies are byte-identical to `shared/` after `npm run sync`
- [x] `npm test` passes
