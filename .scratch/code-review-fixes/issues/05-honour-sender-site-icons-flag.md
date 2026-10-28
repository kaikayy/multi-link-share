# 05: Make the sender's site-icons setting work, as a recipient opt-in

**What to build:** MINIMAL-LINKS.md lists site icons as a view flag carried in the link, and the sender sets it, but the viewer never reads it; it only looks at its own local setting. Make the flag meaningful in a privacy-respecting way consistent with ticket 04: when the sender asked for icons and the recipient has made no choice, the recipient is offered icons (loading them contacts each site) rather than having them applied silently. The recipient's stored choice always wins.

**Blocked by:** 03, 04

**Status:** done

- [x] The viewer reads the site-icons flag from the link
- [x] With no stored recipient choice, icons are not loaded automatically; the recipient can enable them in one step when the sender requested them
- [x] A stored recipient choice (on or off) overrides the link's flag
- [x] Behaviour matches what MINIMAL-LINKS.md says the flag does (update the doc's wording only if needed to describe the opt-in)
