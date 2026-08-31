/* Applies the saved theme before the stylesheet paints, so there's no flash.
   Dark is the default; only "light" is stamped onto <html>. */
(function () {
  try {
    if (localStorage.getItem("ts:theme") === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    }
  } catch (e) {}
})();
