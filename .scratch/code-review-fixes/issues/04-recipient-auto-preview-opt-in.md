# 04: Recipients no longer auto-load shared sites unless they turn it on themselves

**What to build:** PRIVACY.md promises the viewer makes no requests of its own unless auto-preview is enabled in the viewer's settings. In practice, when the recipient has never chosen, the viewer falls back to the sender's auto-preview flag, and the sender's default is on, so by default a recipient's browser loads framable shared sites with no action from them. Change the code to match the promise: with no recipient choice stored, auto-preview is off. The sender's preference may be surfaced (e.g. a hint or one-click "turn on previews") but is never applied silently.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Opening a fresh share link in a browser with no stored viewer setting loads no third-party page until the recipient acts, regardless of the sender's flag
- [ ] A recipient who turns auto-preview on keeps that choice for later links; turning it off sticks too
- [ ] If the sender's flag requests previews, the recipient sees a clear way to enable them (optional, but the flag must not auto-apply)
- [ ] The self-test or a viewer test covers the "no stored choice + sender flag on" case
