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
  return {
    // Trailing slash required. Override at build time with VIEWER_BASE=...
    DEFAULT_VIEWER_BASE: "https://kaikayy.github.io/multi-link-share/",
    PROJECT_URL: "https://github.com/kaikayy/multi-link-share",
    // Warn in the popup when a link gets unwieldy (browsers handle far more,
    // but some chat apps truncate).
    SOFT_URL_LIMIT: 12000,
  };
});
