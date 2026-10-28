# 08: Password-protected links get the "Open with Tab Share" button

**What to build:** README promises that when a Tab Share link is opened in a browser with the extension installed, an "Open with Tab Share" button appears. For password-protected links the banner currently bails out and no button is shown. Make the button available for password links too: after the recipient unlocks the link in the viewer, the decrypted page list can be imported into tabs, a window or a tab group like any other link. The password and decrypted contents must not leave the page except to open the chosen tabs.

**Blocked by:** None (can start immediately)

**Status:** done (manual browser check pending)

- [x] Opening a password link with the extension installed shows the button once the link is unlocked (or a locked state that becomes active after unlock)
- [x] Importing an unlocked password link opens the same pages as the viewer shows, in the chosen mode
- [x] The password is never stored or sent to the background; only the decrypted URLs are passed when the user clicks
- [x] Non-password links behave as before
