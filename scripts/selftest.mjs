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

/** Recreate a v2 token (encode() now emits v4). */
function encodeV2(collection) {
  const pages = collection.pages.map((p) => {
    const u = p.u || p.url;
    return [u.startsWith("https://") ? u.slice(8) : u, p.t || p.title || ""];
  });
  return LZString.compressToEncodedURIComponent(JSON.stringify([2, collection.title || "", Date.now(), pages]));
}

/** Recreate a v3 token: [3, name, created, [[url,title]...], flags]. */
function encodeV3(collection) {
  const pages = collection.pages.map((p) => {
    const u = p.u || p.url;
    return [u.startsWith("https://") ? u.slice(8) : u, p.t || p.title || ""];
  });
  const payload = [3, collection.title || "", collection.created || Date.now(), pages, collection.flags | 0];
  return LZString.compressToEncodedURIComponent(JSON.stringify(payload)).replace(/\+/g, "_");
}

let pass = 0;
const tests = [];
const ok = (name, fn) => tests.push({ name, fn });

async function run() {
  for (const { name, fn } of tests) {
    try {
      await fn();
      pass++;
      console.log("  ✓", name);
    } catch (e) {
      console.error("  ✗", name, "\n   ", e.message);
      process.exitCode = 1;
    }
  }
  console.log(`\n${pass} checks passed.`);
}

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
  assert.equal(out.flags, 0);
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

ok("carries the flags bitfield", () => {
  const token = ShareCodec.encode({ title: "F", flags: 0b11, pages: [{ u: "https://example.com/", t: "x" }] });
  assert.equal(ShareCodec.decode(token).flags, 3);
});

ok("tokens never contain a '+' (chat apps form-decode it to space)", () => {
  const pages = Array.from({ length: 40 }, (_, i) => ({
    u: `https://example.com/section/${i}/some-slug-${i}-${i * 7}`,
    t: `A representative page title number ${i} of middling length`,
  }));
  const token = ShareCodec.encode({ title: "Plus check", pages });
  assert.ok(!token.includes("+"), "token still has a '+'");
  assert.equal(ShareCodec.decode(token).pages.length, 40);
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
  assert.ok(token.length < v1len, `v3 (${token.length}) should be shorter than v1 (${v1len})`);
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
  assert.equal(out.flags, 0);
});

ok("still decodes v2 links", () => {
  const token = encodeV2({ title: "v2 link", pages: [{ u: "https://a.example/x", t: "A" }] });
  const out = ShareCodec.decode(token);
  assert.equal(out.title, "v2 link");
  assert.deepEqual(out.pages.map((p) => p.url), ["https://a.example/x"]);
});

ok("still decodes v3 links (the shipped format before v4)", () => {
  const token = encodeV3({
    title: "v3 link",
    created: 1700000000000,
    flags: 0b11,
    pages: [
      { u: "https://en.wikipedia.org/wiki/Aurora", t: "Aurora" },
      { u: "http://example.org/plain", t: "" },
    ],
  });
  const out = ShareCodec.decode(token);
  assert.equal(out.title, "v3 link");
  assert.equal(out.created, 1700000000000);
  assert.equal(out.flags, 3);
  assert.deepEqual(out.pages.map((p) => p.url), [
    "https://en.wikipedia.org/wiki/Aurora",
    "http://example.org/plain",
  ]);
  assert.equal(out.pages[0].title, "Aurora");
});

ok("v4 minimal link: URLs only, no titles, no timestamp -- still opens", () => {
  const pages = [
    { u: "https://a.example/one", t: "First page" },
    { u: "https://a.example/two", t: "Second page" },
  ];
  const full = ShareCodec.encode({ title: "Trip", flags: 1, pages });
  const min = ShareCodec.encode({ title: "Trip", flags: 1, pages }, { minimal: true });

  const rawMin = LZString.decompressFromEncodedURIComponent(min.replace(/_/g, "+"));
  assert.equal(rawMin, '[4,"Trip",1,["a.example/one","a.example/two"]]', "minimal payload should be [4,name,flags,urls]");

  const out = ShareCodec.decode(min);
  assert.equal(out.title, "Trip");
  assert.equal(out.flags, 1);
  assert.equal(out.created, null);
  assert.deepEqual(out.pages.map((p) => p.url), ["https://a.example/one", "https://a.example/two"]);
  assert.deepEqual(out.pages.map((p) => p.title), ["", ""]);
  assert.ok(min.length < full.length, `minimal (${min.length}) should be shorter than full (${full.length})`);
});

ok("strips tracking params on encode, keeps real params and the #fragment", () => {
  const token = ShareCodec.encode({
    pages: [
      { u: "https://shop.example/item?id=42&utm_source=newsletter&utm_medium=email&color=blue" },
      { u: "https://news.example/story?fbclid=AbC123&gclid=xyz" },
      { u: "https://docs.example/guide?utm_campaign=q3#installation" },
      { u: "https://site.example/page?si=session-abc&ext=pdf" },
    ],
  });
  const out = ShareCodec.decode(token);
  assert.equal(out.pages[0].url, "https://shop.example/item?id=42&color=blue", "real params kept, utm_* dropped");
  assert.equal(out.pages[1].url, "https://news.example/story", "every param was a tracker -> bare path");
  assert.equal(out.pages[2].url, "https://docs.example/guide#installation", "the page's own #fragment survives");
  assert.equal(out.pages[3].url, "https://site.example/page?si=session-abc&ext=pdf", "generic names (si, ext) are NOT stripped");
});

ok("keeps http:// but drops https:// prefix internally", () => {
  const token = ShareCodec.encode({
    pages: [{ u: "https://a.example/x", t: "A" }, { u: "http://b.example/y", t: "B" }],
  });
  const raw = LZString.decompressFromEncodedURIComponent(token);
  assert.ok(raw.includes('"a.example/x"'), "https:// should be stripped in the payload");
  assert.ok(raw.includes('"http://b.example/y"'), "http:// should be kept verbatim");
  const out = ShareCodec.decode(token);
  assert.deepEqual(out.pages.map((p) => p.url), ["https://a.example/x", "http://b.example/y"]);
});

ok("password links round-trip and reject a wrong password", async () => {
  const input = {
    title: "Secret set",
    pages: [{ u: "https://example.com/one", t: "One" }, { u: "https://example.com/two", t: "Two" }],
  };
  const plain = ShareCodec.encode(input);
  const token = await ShareCodec.encrypt(plain, "correct horse");
  assert.ok(token.startsWith("E1."), "encrypted token has the E1. tag");

  const dec = ShareCodec.decode("#" + token);
  assert.equal(dec.encrypted, true);

  const bad = await ShareCodec.decrypt(dec._params, "wrong");
  assert.equal(bad, null, "wrong password decrypts to null");

  const good = await ShareCodec.decrypt(dec._params, "correct horse");
  assert.equal(good.title, "Secret set");
  assert.deepEqual(good.pages.map((p) => p.url), ["https://example.com/one", "https://example.com/two"]);
});

ok("an encrypted token exposes no readable URLs", async () => {
  const token = await ShareCodec.encrypt(
    ShareCodec.encode({ pages: [{ u: "https://very-secret.example/path", t: "x" }] }),
    "pw"
  );
  assert.ok(!token.includes("very-secret"), "the host must not appear in the ciphertext token");
});

ok("monogram is deterministic and offline", () => {
  const a = Monogram.forUrl("https://www.github.com/x");
  const b = Monogram.forUrl("https://github.com/y");
  assert.equal(a.bg, b.bg);
  assert.equal(a.label, "GI");
});

run();
