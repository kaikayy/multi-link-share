# 07: Opening tabs from the viewer needs a real click

**What to build:** The extension's content script on the viewer page opens up to 200 tabs when the page posts an "open" message. It already rejects messages from other origins, but anything running on the viewer origin can trigger it without a user gesture, and a saved default import mode opens every page as soon as a link loads. Require a genuine user action before tabs are opened, and make the auto-import mode confirm before opening a large batch.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Viewer "Open all / Open selected" buttons still open tabs when clicked
- [ ] An "open" message not caused by a user click (e.g. posted from script on load) opens nothing
- [ ] With a saved default import mode, opening a link with more than a small threshold of pages asks before opening them
- [ ] The cross-origin rejection that exists today is kept
