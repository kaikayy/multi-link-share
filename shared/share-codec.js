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

  // v2 is the compact array form `[2, name, created, [[url, title], ...]]`.
  // v1 (the object `{v:1,n,c,p}`) is still decoded so old links keep working.
  var SCHEMA_VERSION = 2;
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

  function hostOf(url) {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return "";
    }
  }

  // Drop the "https://" prefix (the common case) to shave bytes; "http://" and
  // anything else is kept verbatim so decode can tell them apart.
  function packUrl(url) {
    return url.indexOf("https://") === 0 ? url.slice(8) : url;
  }

  function unpackUrl(value) {
    if (typeof value !== "string") return null;
    var full = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : "https://" + value;
    return sanitizeUrl(full);
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
      var title = clean(p.title != null ? p.title : p.t, MAX_TITLE);
      // A title that just echoes the hostname carries no information — drop it.
      if (title && title === hostOf(url)) title = "";
      pages.push([packUrl(url), title]);
      if (pages.length >= MAX_PAGES) break;
    }
    if (!pages.length) {
      throw new Error("encode: no valid http(s) links to share");
    }
    var payload = [SCHEMA_VERSION, clean(collection.title, MAX_NAME), Date.now(), pages];
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

    var name, created, rawRows, compact;
    if (Array.isArray(obj) && obj[0] === 2 && Array.isArray(obj[3])) {
      // v2: [2, name, created, [[url, title], ...]]
      name = obj[1];
      created = obj[2];
      rawRows = obj[3];
      compact = true;
    } else if (obj && obj.v === 1 && Array.isArray(obj.p)) {
      // v1: { v:1, n, c, p:[[url, title], ...] }
      name = obj.n;
      created = obj.c;
      rawRows = obj.p;
      compact = false;
    } else {
      return null;
    }

    var pages = [];
    for (var i = 0; i < rawRows.length && pages.length < MAX_PAGES; i++) {
      var row = rawRows[i];
      if (!Array.isArray(row)) continue;
      var url = compact ? unpackUrl(row[0]) : sanitizeUrl(row[0]);
      if (!url) continue;
      pages.push({ url: url, title: clean(row[1], MAX_TITLE) });
    }
    if (!pages.length) return null;

    return {
      title: clean(name, MAX_NAME),
      created: typeof created === "number" && isFinite(created) ? created : null,
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
