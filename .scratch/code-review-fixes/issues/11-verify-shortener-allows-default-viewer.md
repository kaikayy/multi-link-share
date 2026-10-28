# 11: Check that the shortener service accepts the default viewer

**What to build:** The built-in tabshare shortener is said to "work with no setup", and the in-app text says it accepts the default viewer host, but ROADMAP says it only allows the GitHub Pages viewer. The allow-list lives in the separate shortener service, so this can't be checked from this repo. Check the live service (or its repo) and confirm that links pointing at the default viewer host can be shortened. If not, either update the service's allow-list or change the default viewer / docs.

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

- [ ] Shortening a link for the default viewer host via the built-in shortener succeeds (or the failure is recorded)
- [ ] ROADMAP and the in-app text state the actual allow-list

## Comments

**2026-10-28 (Claude):** The shortener's public README (`kaikayy/tab-share-shortener`) says the instance at `s.kaikay.de` "currently shortens links pointing at `kaikayy.github.io` only", and the allow-list is the `SHORTENER_HOSTS` env var (default `kaikayy.github.io`). Since beta.12 the extension's default viewer is `viewer.kaikay.de`, which the README doesn't list. Either the README is stale or default-viewer links can't be shortened. Check `SHORTENER_HOSTS` / `SHORTENER_HOSTS_FILE` on the server, then fix the server config or the README accordingly.
