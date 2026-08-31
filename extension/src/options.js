(function () {
  "use strict";
  const api = globalThis.browser && globalThis.browser.runtime ? globalThis.browser : globalThis.chrome;
  const CFG = globalThis.TabShareConfig;
  const $ = (s) => document.querySelector(s);

  function normalize(url) {
    const v = (url || "").trim();
    if (!v) return "";
    let parsed;
    try {
      parsed = new URL(v);
    } catch (e) {
      throw new Error("That is not a valid URL.");
    }
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
      throw new Error("Use an https:// address (localhost is allowed for testing).");
    }
    let out = parsed.href;
    if (!out.endsWith("/")) out += "/";
    return out;
  }

  async function load() {
    const { viewerBase } = await api.storage.local.get("viewerBase");
    $("#viewer-base").value = viewerBase || "";
    $("#viewer-base").placeholder = CFG.DEFAULT_VIEWER_BASE;

    const { recents = [] } = await api.storage.local.get("recents");
    $("#recent-count").textContent = recents.length
      ? `${recents.length} recent link${recents.length === 1 ? "" : "s"} stored on this device.`
      : "No links created yet.";
  }

  async function save() {
    $("#save-msg").hidden = true;
    $("#save-err").hidden = true;
    let value;
    try {
      value = normalize($("#viewer-base").value);
    } catch (e) {
      $("#save-err").textContent = e.message;
      $("#save-err").hidden = false;
      return;
    }
    await api.storage.local.set({ viewerBase: value });
    $("#viewer-base").value = value;
    $("#save-msg").hidden = false;
  }

  document.addEventListener("DOMContentLoaded", () => {
    load();
    $("#save").addEventListener("click", save);
    $("#reset").addEventListener("click", async () => {
      await api.storage.local.remove("viewerBase");
      $("#viewer-base").value = "";
      $("#save-msg").hidden = false;
    });
    $("#clear-recents").addEventListener("click", async () => {
      await api.storage.local.remove("recents");
      $("#recent-count").textContent = "No links created yet.";
    });
  });
})();
