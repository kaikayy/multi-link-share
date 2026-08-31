/*!
 * monogram.js — deterministic, offline avatar for a URL.
 *
 * The viewer renders zero third-party requests, so instead of fetching a
 * favicon we draw a coloured monogram derived from the hostname. Shared by
 * the extension popup and the viewer.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Monogram = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Same hues as the icon artwork.
  var PALETTE = [
    "#6366F1", "#8B5CF6", "#A855F7", "#EC4899", "#F43F5E",
    "#F59E0B", "#10B981", "#14B8A6", "#06B6D4", "#3B82F6",
  ];

  function hostOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch (e) {
      return "";
    }
  }

  function hashString(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }

  function forUrl(url) {
    var host = hostOf(url);
    var base = host.split(".")[0] || (typeof url === "string" ? url : "") || "?";
    var label = base.slice(0, 2).toUpperCase();
    var color = PALETTE[hashString(host || base) % PALETTE.length];
    return { host: host, label: label, bg: color, fg: "#ffffff" };
  }

  return { forUrl: forUrl, hostOf: hostOf };
});
