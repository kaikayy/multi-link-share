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
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      throw new Error("Use an https:// address (localhost is allowed for testing).");
    }
    let out = parsed.href;
    if (!out.endsWith("/")) out += "/";
    return out;
  }

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (el.hidden = true), 1800);
  }

  /** The one host the manifest's static content_scripts entry already covers. */
  function isBuiltInOrigin(base) {
    try {
      return new URL(base).hostname === "kaikayy.github.io";
    } catch (e) {
      return true;
    }
  }

  /* ---------------- viewer address ---------------- */

  async function loadViewer() {
    const { viewerBase } = await api.storage.local.get("viewerBase");
    $("#viewer-base").value = viewerBase || "";
    $("#viewer-base").placeholder = CFG.DEFAULT_VIEWER_BASE;
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

    // Any viewer host other than the packaged default (localhost included) needs
    // a one-time host permission so the import banner can appear there.
    if (value && !isBuiltInOrigin(value)) {
      try {
        const pattern = new URL(value).origin + "/*";
        const has = await api.permissions.contains({ origins: [pattern] });
        if (!has) {
          const granted = await api.permissions.request({ origins: [pattern] });
          if (!granted) {
            $("#save-err").textContent =
              "Saved, but without access to that host the import banner won't show there.";
            $("#save-err").hidden = false;
          }
        }
      } catch (e) {
        /* older browser without host permission prompts — ignore */
      }
    }

    await api.storage.local.set({ viewerBase: value });
    $("#viewer-base").value = value;
    $("#save-msg").hidden = false;
  }

  /* ---------------- history ---------------- */

  function relDate(ts) {
    if (!ts) return "";
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + " min ago";
    if (s < 86400) return Math.floor(s / 3600) + " h ago";
    const d = Math.floor(s / 86400);
    if (d < 30) return d + " d ago";
    try {
      return new Date(ts).toLocaleDateString();
    } catch (e) {
      return "";
    }
  }

  async function getHistory() {
    const { recents = [] } = await api.storage.local.get("recents");
    return recents;
  }

  async function renderHistory() {
    const list = $("#hist-list");
    const tpl = $("#tpl-hist-row");
    const items = await getHistory();

    $("#hist-empty").hidden = items.length > 0;
    list.innerHTML = "";

    items.forEach((r, idx) => {
      const id = r.id || String(r.at || idx);
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.querySelector(".h-name").textContent = r.name || "Untitled";
      node.querySelector(".h-sub").textContent =
        `${r.count || 0} page${r.count === 1 ? "" : "s"} · ${relDate(r.at)}`;

      node.querySelector(".h-acts").addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-act]");
        if (!btn) return;
        const act = btn.dataset.act;
        if (act === "copy") {
          try {
            await navigator.clipboard.writeText(r.link);
            toast("Link copied");
          } catch (err) {
            toast("Could not copy");
          }
        } else if (act === "open") {
          api.tabs.create({ url: r.link });
        } else if (act === "remove") {
          const next = (await getHistory()).filter((x) => (x.id || String(x.at)) !== id);
          await api.storage.local.set({ recents: next });
          renderHistory();
        }
      });

      list.appendChild(node);
    });
  }

  /* ---------------- wire up ---------------- */

  document.addEventListener("DOMContentLoaded", () => {
    loadViewer();
    renderHistory();

    $("#save").addEventListener("click", save);
    $("#viewer-base").addEventListener("input", () => {
      $("#save-msg").hidden = true;
      $("#save-err").hidden = true;
    });
    $("#reset").addEventListener("click", async () => {
      await api.storage.local.remove("viewerBase");
      $("#viewer-base").value = "";
      $("#save-msg").hidden = false;
    });
    $("#clear-recents").addEventListener("click", async () => {
      await api.storage.local.remove("recents");
      renderHistory();
    });
  });
})();
