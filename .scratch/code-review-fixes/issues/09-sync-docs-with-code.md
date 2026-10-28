# 09: Bring README, PRIVACY and ROADMAP in line with the code

**What to build:** After the privacy fixes land, update the user-facing docs so every factual claim matches the shipped behaviour:

- README's Firefox minimum version matches the Firefox manifest (140), and the version it mentions matches the manifests
- ROADMAP's "Done" shortener list matches the providers actually offered (no is.gd / v.gd unless they are added back)
- README and PRIVACY describe site icons as off by default, and describe the recipient opt-in from tickets 04 and 05
- PRIVACY's list of stored data includes the page-list drafts kept in session storage
- PRIVACY's description of when tabs are read matches ticket 06, and the import-button behaviour matches tickets 07 and 08

**Blocked by:** 04, 05, 06, 07, 08

**Status:** ready-for-agent

- [ ] Every bullet above is reflected in the docs
- [ ] No claim in README, PRIVACY or ROADMAP "Done" contradicts the code (spot-check each privacy promise against the code)
- [ ] CHANGELOG has an entry for the user-visible privacy changes
