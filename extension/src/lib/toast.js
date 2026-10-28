/*!
 * toast.js -- the short status message the popup, options page and viewer
 * flash. One element per page; a new message replaces the current one.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Toast = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /** Returns `toast(msg, ms?)` bound to `el`; it hides again after `ms`
   *  (default `defaultMs`). */
  function create(el, defaultMs) {
    var timer = 0;
    return function (msg, ms) {
      el.textContent = msg;
      el.hidden = false;
      clearTimeout(timer);
      timer = setTimeout(function () {
        el.hidden = true;
      }, ms || defaultMs);
    };
  }

  return { create: create };
});
