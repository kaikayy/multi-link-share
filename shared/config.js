/*!
 * config.js — build-time defaults.
 *
 * DEFAULT_VIEWER_BASE is where the static viewer (viewer/index.html) is
 * hosted. Ship the extension pointing at your own deployment, or leave the
 * placeholder and users set it once in the options page.
 *
 * Must be an https:// origin you control. The generated share link is:
 *   <DEFAULT_VIEWER_BASE>#<encoded-collection>
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TabShareConfig = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var LOCAL_ADDR = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i;
  // The hosts the manifests' static content_scripts entry covers. Keep in sync
  // with the "matches" list in extension/manifest.*.json.
  var BUILTIN_VIEWER_HOSTS = ["viewer.kaikay.de", "kaikayy.github.io"];

  /** A Tab Share shortener address without trailing slashes. */
  function shortenerBase(base) {
    return String(base || "").trim().replace(/\/+$/, "");
  }

  return {
    // Trailing slash required. Override at build time with VIEWER_BASE=...
    DEFAULT_VIEWER_BASE: "https://viewer.kaikay.de/",
    PROJECT_URL: "https://github.com/kaikayy/multi-link-share",
    // Address pre-filled when a user picks the "Tab Share shortener" provider.
    // The first-party public instance; the shortener still stays Off until the
    // user turns it on. Override at build time with SHORTENER_BASE=... npm run
    // build, or set it to "" to ship with no default.
    DEFAULT_SHORTENER_BASE: "https://s.kaikay.de",
    // Warn in the popup when a link gets unwieldy (browsers handle far more,
    // but some chat apps truncate).
    SOFT_URL_LIMIT: 12000,

    /** True for an http(s) address on localhost / 127.0.0.1 (any port). */
    isLocalAddress: function (url) {
      return LOCAL_ADDR.test(String(url || "").trim());
    },

    /** True in a DEV_LOCALHOST build, whose manifest makes localhost a
     *  grantable host. Pass `runtime.getManifest()`. */
    localhostGrantable: function (manifest) {
      var perms = (manifest && manifest.optional_host_permissions) || [];
      return perms.some(function (p) {
        return /^https?:\/\/(localhost|127\.0\.0\.1)\//.test(p);
      });
    },

    /** True when `url` is on a host the static content script already covers.
     *  False for anything that doesn't parse. */
    isBuiltInViewer: function (url) {
      try {
        return BUILTIN_VIEWER_HOSTS.indexOf(new URL(url).hostname) !== -1;
      } catch (e) {
        return false;
      }
    },

    shortenerBase: shortenerBase,

    /** Turn a Tab Share shortener base + style ("code" | "words") into the
     *  endpoint string the popup appends the encoded long URL to. */
    shortenerEndpoint: function (base, mode) {
      return shortenerBase(base) + "/new?" + (mode === "words" ? "mode=words&" : "") + "url=";
    },
  };
});
