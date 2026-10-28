# 11: Check that the shortener service accepts the default viewer

**What to build:** The built-in tabshare shortener is said to "work with no setup", and the in-app text says it accepts the default viewer host, but ROADMAP says it only allows the GitHub Pages viewer. The allow-list lives in the separate shortener service, so this can't be checked from this repo. Check the live service (or its repo) and confirm that links pointing at the default viewer host can be shortened. If not, either update the service's allow-list or change the default viewer / docs.

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

- [ ] Shortening a link for the default viewer host via the built-in shortener succeeds (or the failure is recorded)
- [ ] ROADMAP and the in-app text state the actual allow-list
