/*!
 * share-codec.js — encode / decode a tab collection to a URL-safe string.
 *
 * The entire collection lives inside the URL fragment (`#...`) of the viewer
 * link. Fragments are never sent to a web server, so no backend and no data
 * storage are involved. Works as a plain <script> (browser global
 * `ShareCodec`) and as a CommonJS module.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./lzstring.min.js"));
  } else {
    root.ShareCodec = factory(root.LZString);
  }
})(typeof self !== "undefined" ? self : this, function (LZString) {
  "use strict";

  var SCHEMA_VERSION = 1;
  var MAX_PAGES = 100;
  var MAX_URL = 4000;
  var MAX_TITLE = 300;
  var MAX_NAME = 200;

  function sanitizeUrl(value) {
    if (typeof value !== "string") return null;
    var parsed;
    try {
      parsed = new URL(value);
    } catch (e) {
      return null;
    }
    // Only shareable web pages. Blocks javascript:, data:, file:,
    // chrome:, about:, moz-extension:, etc.
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.href.slice(0, MAX_URL);
  }

  function clean(str, max) {
    return String(str == null ? "" : str)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);
  }

  /**
   * @param {{title?:string, pages:Array<{url?:string,u?:string,title?:string,t?:string}>}} collection
   * @returns {string} URL-safe fragment payload (no leading '#')
   */
  function encode(collection) {
    if (!collection || !Array.isArray(collection.pages)) {
      throw new Error("encode: expected { pages: [] }");
    }
    var seen = Object.create(null);
    var pages = [];
    for (var i = 0; i < collection.pages.length; i++) {
      var p = collection.pages[i] || {};
      var url = sanitizeUrl(p.url != null ? p.url : p.u);
      if (!url || seen[url]) continue;
      seen[url] = true;
      pages.push([url, clean(p.title != null ? p.title : p.t, MAX_TITLE)]);
      if (pages.length >= MAX_PAGES) break;
    }
    if (!pages.length) {
      throw new Error("encode: no valid http(s) links to share");
    }
    var payload = {
      v: SCHEMA_VERSION,
      n: clean(collection.title, MAX_NAME),
      c: Date.now(),
      p: pages,
    };
    return LZString.compressToEncodedURIComponent(JSON.stringify(payload));
  }

  /**
   * @param {string} fragment  value of location.hash (with or without '#')
   * @returns {{title:string, created:(number|null), pages:Array<{url:string,title:string}>}|null}
   */
  function decode(fragment) {
    if (typeof fragment !== "string") return null;
    var token = fragment.replace(/^#/, "").trim();
    if (!token) return null;

    var raw = null;
    try {
      raw = LZString.decompressFromEncodedURIComponent(token);
    } catch (e) {
      raw = null;
    }
    if (!raw) return null;

    var obj;
    try {
      obj = JSON.parse(raw);
    } catch (e) {
      return null;
    }
    if (!obj || obj.v !== SCHEMA_VERSION || !Array.isArray(obj.p)) return null;

    var pages = [];
    for (var i = 0; i < obj.p.length && pages.length < MAX_PAGES; i++) {
      var row = obj.p[i];
      if (!Array.isArray(row)) continue;
      var url = sanitizeUrl(row[0]);
      if (!url) continue;
      pages.push({ url: url, title: clean(row[1], MAX_TITLE) });
    }
    if (!pages.length) return null;

    return {
      title: clean(obj.n, MAX_NAME),
      created: typeof obj.c === "number" && isFinite(obj.c) ? obj.c : null,
      pages: pages,
    };
  }

  return {
    encode: encode,
    decode: decode,
    sanitizeUrl: sanitizeUrl,
    SCHEMA_VERSION: SCHEMA_VERSION,
    MAX_PAGES: MAX_PAGES,
  };
});
