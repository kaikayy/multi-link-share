/*!
 * share-codec.js — encode / decode a tab collection to a URL-safe string.
 *
 * The entire collection lives inside the URL fragment (`#...`) of the viewer
 * link. Fragments are never sent to a web server, so no backend and no data
 * storage are involved. Works as a plain <script> (browser global
 * `ShareCodec`) and as a CommonJS module.
 *
 * Token shapes:
 *   plaintext  — LZString.compressToEncodedURIComponent(JSON) of
 *                v3 `[3, name, created, pages, flags]`  (v1/v2 still decode)
 *   encrypted  — "E1." + b64url(salt) "." b64url(iv) "." b64url(ciphertext)
 *                where ciphertext = AES-GCM( the plaintext token above ),
 *                key = PBKDF2(password, salt, 210000, SHA-256)
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./lzstring.min.js"));
  } else {
    root.ShareCodec = factory(root.LZString);
  }
})(typeof self !== "undefined" ? self : this, function (LZString) {
  "use strict";

  var SCHEMA_VERSION = 3; // [3, name, created, pages, flags]
  var MAX_PAGES = 100;
  var MAX_URL = 4000;
  var MAX_TITLE = 300;
  var MAX_NAME = 200;

  var ENC_PREFIX = "E1.";
  var PBKDF2_ITERS = 210000;

  var cryptoObj = (typeof self !== "undefined" && self.crypto) || (typeof globalThis !== "undefined" && globalThis.crypto) || null;
  var subtle = cryptoObj && cryptoObj.subtle ? cryptoObj.subtle : null;

  /* ---------- shared helpers ---------- */

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

  /* ---------- base64url <-> bytes ---------- */

  function bytesToB64url(bytes) {
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    var b64 = (typeof btoa === "function" ? btoa(bin) : Buffer.from(bytes).toString("base64"));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function b64urlToBytes(str) {
    var b64 = String(str).replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    var bin = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /* ---------- encode ---------- */

  /**
   * @param {{title?:string, flags?:number, pages:Array<{url?:string,u?:string,title?:string,t?:string}>}} collection
   * @returns {string} URL-safe *plaintext* fragment payload (no leading '#').
   *                    Wrap with encrypt() for a password link.
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
    var flags = collection.flags | 0;
    var payload = [SCHEMA_VERSION, clean(collection.title, MAX_NAME), Date.now(), pages, flags];
    // LZString's URI-safe alphabet still contains "+", which many chat apps and
    // link unfurlers form-decode to a space. Swap it for "_" (truly unreserved).
    return LZString.compressToEncodedURIComponent(JSON.stringify(payload)).replace(/\+/g, "_");
  }

  /* ---------- decode (plaintext) ---------- */

  function decodePlain(token) {
    if (typeof token !== "string" || !token) return null;

    var raw = null;
    try {
      // Undo the "+"→"_" swap from encode(). Old links (raw "+") have no "_",
      // so this is a no-op there.
      raw = LZString.decompressFromEncodedURIComponent(token.replace(/_/g, "+"));
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

    var name, created, rawRows, flags, compact;
    if (Array.isArray(obj) && (obj[0] === 3 || obj[0] === 2) && Array.isArray(obj[3])) {
      // v3: [3, name, created, [[url,title]...], flags]
      // v2: [2, name, created, [[url,title]...]]
      name = obj[1];
      created = obj[2];
      rawRows = obj[3];
      flags = obj[0] === 3 ? obj[4] | 0 : 0;
      compact = true;
    } else if (obj && obj.v === 1 && Array.isArray(obj.p)) {
      // v1: { v:1, n, c, p:[[url,title]...] }
      name = obj.n;
      created = obj.c;
      rawRows = obj.p;
      flags = 0;
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
      flags: flags,
      pages: pages,
    };
  }

  /**
   * @param {string} fragment  value of location.hash (with or without '#')
   * @returns {{title,created,flags,pages}|{encrypted:true,_params:{salt,iv,ct}}|null}
   */
  function decode(fragment) {
    if (typeof fragment !== "string") return null;
    var token = fragment.replace(/^#/, "").trim();
    if (!token) return null;

    if (token.slice(0, ENC_PREFIX.length) === ENC_PREFIX) {
      var parts = token.slice(ENC_PREFIX.length).split(".");
      if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
      return { encrypted: true, _params: { salt: parts[0], iv: parts[1], ct: parts[2] } };
    }
    return decodePlain(token);
  }

  /* ---------- encryption ---------- */

  function deriveKey(password, saltBytes) {
    var enc = new TextEncoder();
    return subtle
      .importKey("raw", enc.encode(String(password)), { name: "PBKDF2" }, false, ["deriveKey"])
      .then(function (baseKey) {
        return subtle.deriveKey(
          { name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITERS, hash: "SHA-256" },
          baseKey,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"]
        );
      });
  }

  /**
   * Wrap a plaintext token from encode() into a password-protected token.
   * @returns {Promise<string>}
   */
  function encrypt(plainToken, password) {
    if (!subtle) return Promise.reject(new Error("Encryption is not available in this browser."));
    if (!password) return Promise.reject(new Error("A password is required."));
    var salt = cryptoObj.getRandomValues(new Uint8Array(16));
    var iv = cryptoObj.getRandomValues(new Uint8Array(12));
    return deriveKey(password, salt)
      .then(function (key) {
        return subtle.encrypt({ name: "AES-GCM", iv: iv }, key, new TextEncoder().encode(plainToken));
      })
      .then(function (ctBuf) {
        return (
          ENC_PREFIX +
          bytesToB64url(salt) + "." + bytesToB64url(iv) + "." + bytesToB64url(new Uint8Array(ctBuf))
        );
      });
  }

  /**
   * @param {{salt:string,iv:string,ct:string}} params  from decode().._params
   * @returns {Promise<collection|null>}  null on a wrong password / tampering.
   */
  function decrypt(params, password) {
    if (!subtle) return Promise.reject(new Error("Encryption is not available in this browser."));
    if (!params || !params.salt || !params.iv || !params.ct) return Promise.resolve(null);
    var salt, iv, ct;
    try {
      salt = b64urlToBytes(params.salt);
      iv = b64urlToBytes(params.iv);
      ct = b64urlToBytes(params.ct);
    } catch (e) {
      return Promise.resolve(null);
    }
    return deriveKey(password, salt)
      .then(function (key) {
        return subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ct);
      })
      .then(function (plainBuf) {
        return decodePlain(new TextDecoder().decode(plainBuf));
      })
      .catch(function () {
        return null; // GCM auth failure = wrong password or tampered token
      });
  }

  return {
    encode: encode,
    decode: decode,
    encrypt: encrypt,
    decrypt: decrypt,
    sanitizeUrl: sanitizeUrl,
    SCHEMA_VERSION: SCHEMA_VERSION,
    MAX_PAGES: MAX_PAGES,
  };
});
