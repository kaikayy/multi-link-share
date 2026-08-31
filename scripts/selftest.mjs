#!/usr/bin/env node
/** Round-trips the codec the same way the browser does. `npm test` */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ShareCodec = require(path.join(root, "shared", "share-codec.js"));
const Monogram = require(path.join(root, "shared", "monogram.js"));
const LZString = require(path.join(root, "shared", "lzstring.min.js"));

/** Recreate a legacy v1 token so we can prove old links still decode. */
function encodeV1(collection) {
  const payload = {
    v: 1,
    n: collection.title || "",
    c: collection.created || Date.now(),
    p: collection.pages.map((p) => [p.u || p.url, p.t || p.title || ""]),
  };
  return LZString.compressToEncodedURIComponent(JSON.stringify(payload));
}

let pass = 0;
const ok = (name, fn) => {
  try {
    fn();
    pass++;
    console.log("  ✓", name);
  } catch (e) {
    console.error("  ✗", name, "\n   ", e.message);
    process.exitCode = 1;
  }
};

ok("round-trips a normal collection", () => {
  const input = {
    title: "Research on hummingbirds",
    pages: [
      { u: "https://en.wikipedia.org/wiki/Anna's_hummingbird", t: "Anna's hummingbird" },
      { u: "https://www.youtube.com/watch?v=abc", t: "Slow motion" },
    ],
  };
  const token = ShareCodec.encode(input);
  const out = ShareCodec.decode("#" + token);
  assert.equal(out.title, input.title);
  assert.equal(out.pages.length, 2);
  assert.equal(out.pages[0].url, input.pages[0].u);
  assert.equal(out.pages[1].title, "Slow motion");
});

ok("drops non-http(s) and duplicate links", () => {
  const token = ShareCodec.encode({
    pages: [
      { u: "https://example.com/a", t: "A" },
      { u: "javascript:alert(1)", t: "evil" },
      { u: "file:///etc/passwd", t: "evil2" },
      { u: "https://example.com/a", t: "dup" },
      { u: "https://example.com/b" },
    ],
  });
  const out = ShareCodec.decode(token);
  assert.deepEqual(out.pages.map((p) => p.url), ["https://example.com/a", "https://example.com/b"]);
});

ok("throws when nothing valid remains", () => {
  assert.throws(() => ShareCodec.encode({ pages: [{ u: "chrome://settings" }] }));
});

ok("bad fragments decode to null, never throw", () => {
  for (const bad of ["", "#", "#not-base64-!!!", "#" + Buffer.from("{}").toString("base64")]) {
    assert.equal(ShareCodec.decode(bad), null);
  }
});

ok("large collection stays a sane URL length", () => {
  const pages = Array.from({ length: 30 }, (_, i) => ({
    u: `https://example.com/section/${i}/a-fairly-long-slug-for-the-page-${i}`,
    t: `Page number ${i} — a representative title of middling length`,
  }));
  const token = ShareCodec.encode({ title: "Big set", pages });
  const v1len = encodeV1({ title: "Big set", pages }).length;
  console.log(`      (30 pages -> ${token.length} chars, was ${v1len} under v1)`);
  assert.ok(token.length < 4000, `token too long: ${token.length}`);
  assert.ok(token.length < v1len, `v2 (${token.length}) should be shorter than v1 (${v1len})`);
  assert.equal(ShareCodec.decode(token).pages.length, 30);
});

ok("still decodes legacy v1 links", () => {
  const token = encodeV1({
    title: "Old link",
    created: 1700000000000,
    pages: [
      { u: "https://en.wikipedia.org/wiki/Aurora", t: "Aurora" },
      { u: "http://example.org/plain", t: "" },
    ],
  });
  const out = ShareCodec.decode(token);
  assert.equal(out.title, "Old link");
  assert.equal(out.created, 1700000000000);
  assert.deepEqual(out.pages.map((p) => p.url), [
    "https://en.wikipedia.org/wiki/Aurora",
    "http://example.org/plain",
  ]);
  assert.equal(out.pages[0].title, "Aurora");
});

ok("v2 keeps http:// but drops https:// prefix internally", () => {
  const token = ShareCodec.encode({
    pages: [{ u: "https://a.example/x", t: "A" }, { u: "http://b.example/y", t: "B" }],
  });
  const raw = LZString.decompressFromEncodedURIComponent(token);
  assert.ok(raw.includes('"a.example/x"'), "https:// should be stripped in the payload");
  assert.ok(raw.includes('"http://b.example/y"'), "http:// should be kept verbatim");
  const out = ShareCodec.decode(token);
  assert.deepEqual(out.pages.map((p) => p.url), ["https://a.example/x", "http://b.example/y"]);
});

ok("monogram is deterministic and offline", () => {
  const a = Monogram.forUrl("https://www.github.com/x");
  const b = Monogram.forUrl("https://github.com/y");
  assert.equal(a.bg, b.bg);
  assert.equal(a.label, "GI");
});

console.log(`\n${pass} checks passed.`);
