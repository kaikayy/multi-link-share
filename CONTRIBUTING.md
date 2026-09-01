# Contributing

Thanks for taking a look. This is a small project with a deliberately small
scope -- one link that carries a group of tabs, no account, no server. Fixes,
docs, and framing-list updates are all welcome; please read this first so a pull
request lands smoothly.

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

- **Bugs and small fixes:** open an issue or just send the PR.
- **New features or anything that changes the UI, the link format, or a
  permission:** open an issue first so we can agree on the shape. `ROADMAP.md`
  lists what is planned and what is intentionally out of scope.
- **Security problems:** do not open a public issue -- follow
  [`docs/SECURITY.md`](docs/SECURITY.md).

## Project principles

Keep changes in line with these -- a PR that breaks one is unlikely to merge:

- **No backend.** The extension and the viewer make no network requests except
  the opt-in URL shortener and the opt-in favicon fetch. No analytics, no
  telemetry, no remote code.
- **Tiny permission surface.** Adding or widening a permission needs a strong
  reason and a matching update to the README table and `PRIVACY.md`.
- **Plain HTML / CSS / JS.** No framework, no bundler, no npm runtime
  dependencies. `lz-string` is the only vendored library.
- **The recipient needs nothing.** Any viewer feature has to work in a stock
  browser with no extension installed.

## Development setup

Requires **Node 20+** and the system **`zip`** command. No `npm install` step --
there are no dependencies.

```bash
npm test             # URL codec round-trip tests -- must pass
npm run sync         # copy shared/ libs into extension/ and viewer/
npm run dev          # http://localhost:8778/dev/ -- popup/options/viewer, mocked chrome.*
npm run serve:viewer # http://localhost:8777/    -- the real viewer, append #<token>
npm run build        # dist/chrome + dist/firefox + dist/viewer + zips
```

Full dev workflow, including testing a custom viewer URL and loading the
extension unpacked, is in [`docs/BUILD.md`](docs/BUILD.md).

### `shared/` is canonical

`shared/` holds the real codec and helpers. `extension/` and `viewer/` get
copies via `npm run sync`. Edit the file in `shared/`, run `npm run sync`, and
commit all three.

## Coding conventions

- Match the surrounding code -- indentation, naming, and structure.
- **ASCII punctuation only** in code, comments, and docs: `--` for dashes,
  `...` for ellipsis, `->` for arrows, straight quotes. No em/en dashes or smart
  quotes.
- No new dependencies.
- Keep the diff focused on one thing.

## Tests

`npm test` covers the URL codec (compression, the `+` swap, encryption
round-trip). Run it before every commit. If you touch `shared/share-codec.js`
or the encryption, add a case to `scripts/selftest.mjs`.

There is no automated UI test suite; describe your manual testing in the PR
(browser, what you clicked, what you saw). For anything touching the viewer,
test with the extension both installed and not installed.

## Commits and pull requests

- Present-tense summary, optionally prefixed `fix:` / `docs:` / `chore:` /
  `feat:` as in the existing history.
- Do not bump the version in a feature/fix PR -- the maintainer bumps
  `package.json` and both manifests together at release time (see
  [`docs/BUILD.md`](docs/BUILD.md#version)).
- `dist/` is git-ignored; never commit build output.
- Fill in the pull request template. Link the issue it closes.

## Framing list updates

`viewer/frame-hosts.js` is generated. Do not hand-edit large chunks -- regenerate
it with `tools/frame-probe/` (see its README) and explain any hand-review
overrides in the PR.

## License

The project is **GNU AGPL-3.0-only**. Contributions are accepted under the same
license. Third-party code must be license-compatible and listed in
[`docs/THIRD-PARTY.md`](docs/THIRD-PARTY.md).
