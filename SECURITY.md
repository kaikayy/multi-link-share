# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for a security problem.

- Use GitHub's **[private vulnerability reporting](https://github.com/kaikayy/multi-link-share/security/advisories/new)**
  ("Report a vulnerability" on the Security tab), or
- open a normal issue that only says "security -- please contact me" and nothing
  else, and a maintainer will set up a private channel.

Describe the class of problem and how to reproduce it. Please don't include a
working exploit or a step-by-step extraction path in anything public.

## Scope

In scope:

- the extension (`extension/`) -- popup, options, background worker, and the
  `import-banner.js` content script;
- the viewer (`viewer/`) -- decoding untrusted link fragments, the password
  unlock, the live-preview iframes, the CSP;
- the share codec (`shared/share-codec.js`) -- parsing attacker-controlled
  tokens, the encryption.

Particularly interested in: a viewer-host page driving the import actions
(synthesised clicks, shadow-DOM reach, forged `runtime` messages); XSS from a
crafted token or page title; the sandbox / `referrerPolicy` on preview iframes;
weaknesses in the password KDF/cipher use.

Out of scope:

- the share link is readable by anyone who has it -- that's by design, not a
  vulnerability;
- denial of service from a deliberately huge token;
- issues that require a already-compromised browser or a malicious extension
  already installed alongside Tab Share.

## Handling

There is no server and no user data store, so there is nothing to breach
centrally. Fixes ship as a new version in `dist/` and a new viewer deploy;
self-hosters rebuild and redeploy (see `SELF-HOSTING.md`).
