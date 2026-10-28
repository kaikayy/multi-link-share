# 01: Remove the dead duplicate teardown from the import banner

**What to build:** The "Open with Tab Share" import banner has exactly one teardown routine. Today the banner's script declares two functions with the same name in the same scope; only the later one ever runs, so the earlier one is dead code that misleads readers. Remove the dead one so the button's show/dismiss lifecycle has a single, obvious path.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The import banner script declares a single teardown routine
- [ ] Mounting, dismissing and re-mounting the button behaves exactly as before (menu closes, button and host element are removed, mounted state resets)
- [ ] `npm test` still passes
