# Coding standards

Review-time rules: judgement calls a reviewer applies to a diff. Mechanical
rules live in `npm run check` instead; the conventions in `CONTRIBUTING.md`
apply too.

## Privacy policy twins

`PRIVACY.md` and `viewer/privacy.html` state the same promises. A diff that
changes what one says (what is read, stored, sent, or opened) makes the same
change to the other.

**Why:** the viewer serves `privacy.html` to recipients and store listings link
to it, while contributors edit `PRIVACY.md`. They drifted once already: the
opt-in previews / icons change updated only `PRIVACY.md`.
