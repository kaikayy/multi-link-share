# 06: The popup reads tabs only from the window it was opened in, until you pick another

**What to build:** PRIVACY.md says tabs are read only for the window the user triggered the extension from. Today, opening the popup immediately reads every normal window's tabs (with their URLs and titles) to build the source picker. Change the popup so it reads only the current window up front; other windows (or the list of them) are read only when the user explicitly chooses a different source.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Opening the popup reads tabs from the current window only
- [ ] Choosing another window or "all windows" as the source still works, and reads those tabs only at that moment
- [ ] Tab-group sourcing and drafts keep working
- [ ] Manual check in Chrome and Firefox with two windows open: the second window's tabs are not queried until it is selected
