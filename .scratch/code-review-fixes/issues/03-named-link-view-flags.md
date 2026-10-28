# 03: Give the link's view settings named constants

**What to build:** Prefactor. A share link carries a small "view flags" number holding the sender's site-icons and auto-preview choices. The sender builds it and the viewer reads it with bare magic numbers in two different files. Define named flags once in the share codec (the module both sides already share) and use them on both ends, so the meaning of each bit lives in one place.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The share codec exports named constants (and/or encode/decode helpers) for the site-icons and auto-preview flags
- [ ] Neither the popup nor the viewer uses a raw bit value for these flags any more
- [ ] Links created before the change decode to the same settings as before (no wire-format change)
- [ ] The self-test covers encoding and decoding both flags
