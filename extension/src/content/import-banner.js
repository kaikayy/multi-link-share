/* Tab Share — viewer-page import affordance (content script).
 *
 * Adds ONE button to the viewer's toolbar: "Open with Tab Share". It stays
 * there for the whole session and opens a small menu to send the collection
 * into this window / a new window / a tab group, or save it to history.
 *
 * The menu lives in a CLOSED shadow root and every handler checks
 * `event.isTrusted`, so the host page can't drive the import actions. No
 * network requests; menu markup is built with createElement.
 */
(function () {
  "use strict";

  const api = globalThis.browser && globalThis.browser.runtime ? globalThis.browser : globalThis.chrome;
  if (!api || !api.runtime || typeof ShareCodec === "undefined") return;

  const token = (location.hash || "").replace(/^#/, "").slice(0, 96);
  const K = { auto: "tabshare:auto:" + token };

  // Tell the viewer's page script the extension is here. A content-script global
  // (window.__tabShare) lives in an isolated world the page can't see, so use a
  // DOM marker plus a postMessage channel — both cross the boundary reliably.
  window.__tabShare = true; // kept for older viewers
  document.documentElement.setAttribute("data-tabshare-ext", "1");

  // Let the viewer's "Open all pages" / "Open selected in a new window / tab
  // group" reach the background (a static page can't open tabs itself).
  window.addEventListener("message", (e) => {
    // same document only — the viewer's live-preview iframes are always
    // cross-origin, so this rejects anything they could post
    if (e.origin !== location.origin) return;
    const d = e.data;
    if (!d || d.__tabshare !== "open" || !Array.isArray(d.urls)) return;
    const pages = d.urls
      .filter((u) => typeof u === "string" && /^https?:\/\//i.test(u))
      .slice(0, 200)
      .map((u) => ({ url: u }));
    const mode = ["this-window", "new-window", "tab-group"].indexOf(d.mode) === -1 ? "this-window" : d.mode;
    if (pages.length) api.runtime.sendMessage({ type: "ts-import", mode, collection: { pages } });
  });

  let collection = null;
  try {
    collection = ShareCodec.decode(location.hash);
  } catch (e) {
    collection = null;
  }
  if (!collection || collection.encrypted || !collection.pages || !collection.pages.length) return;
  const count = collection.pages.length;

  /* ---------- menu shadow UI ---------- */

  const CSS =
    ":host{all:initial}" +
    ".wrap{position:fixed;inset:0;pointer-events:none;z-index:2147483647}" +
    ".menu{position:fixed;pointer-events:auto;font:13px/1.45 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;" +
    "background:#1f1b2e;color:#f2f0ff;border:1px solid #38315c;border-radius:14px;" +
    "box-shadow:0 18px 50px rgba(0,0,0,.5);padding:12px;min-width:260px;max-width:320px;" +
    "display:flex;flex-direction:column;gap:8px}" +
    ".hd{font-size:12.5px;color:#b7b0d8}" +
    ".acts{display:flex;flex-direction:column;gap:5px}" +
    "button{font:inherit;cursor:pointer;border-radius:9px;padding:8px 11px;border:1px solid #4a4276;background:#2b2545;color:#f2f0ff;text-align:left}" +
    "button:hover{background:#362e57}" +
    "button.primary{background:#6d5efc;border-color:#6d5efc;color:#fff}" +
    ".save{display:flex;gap:6px}" +
    ".save input{font:inherit;flex:1;min-width:0;border-radius:8px;border:1px solid #4a4276;background:#16121f;color:#f2f0ff;padding:8px 10px}" +
    ".opts{display:flex;flex-direction:column;gap:6px;border-top:1px solid #38315c;padding-top:9px}" +
    ".opts label{display:flex;gap:8px;align-items:center;color:#cfc9e8;font-size:12px;cursor:pointer}" +
    ".link{border:0;background:transparent;color:#b7b0d8;padding:2px;font-size:12px;cursor:pointer;text-align:left}" +
    ".link:hover{color:#f2f0ff;text-decoration:underline}" +
    ".note{margin:0;color:#b7b0d8;font-size:12px}" +
    "[hidden]{display:none!important}";

  function el(tag, attrs, text) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  const host = document.createElement("div");
  host.id = "tab-share-import-host";
  host.style.cssText = "all:initial";
  const root = host.attachShadow({ mode: "closed" });
  root.appendChild(el("style", null, CSS));

  const wrap = el("div", { class: "wrap" });
  const menu = el("div", { class: "menu", role: "menu", hidden: "" });
  menu.appendChild(el("p", { class: "hd" }, `${count} page${count === 1 ? "" : "s"}${collection.title ? " · " + collection.title : ""}`));

  const acts = el("div", { class: "acts" });
  acts.appendChild(el("button", { class: "primary", "data-mode": "this-window" }, "Open in this window"));
  acts.appendChild(el("button", { "data-mode": "new-window" }, "Open in a new window"));
  acts.appendChild(el("button", { "data-mode": "tab-group" }, "Open as a tab group"));
  acts.appendChild(el("button", { "data-mode": "save" }, "Save to history…"));
  menu.appendChild(acts);

  const saveRow = el("div", { class: "save", id: "ts-save-row", hidden: "" });
  saveRow.appendChild(el("input", { id: "ts-save-title", type: "text", maxlength: "200", placeholder: "Title for history" }));
  saveRow.appendChild(el("button", { class: "primary", id: "ts-save-go" }, "Save"));
  menu.appendChild(saveRow);

  const opts = el("div", { class: "opts" });
  const cbAuto = el("input", { type: "checkbox", id: "ts-cb-auto" });
  const lAuto = el("label");
  lAuto.append(cbAuto, el("span", null, "Open this menu automatically"));
  const cbRemember = el("input", { type: "checkbox", id: "ts-cb-remember" });
  const lRem = el("label");
  lRem.append(cbRemember, el("span", null, "Remember my choice as the default"));
  opts.append(lAuto, lRem, el("button", { class: "link", id: "ts-hide" }, "Hide this button"));
  menu.appendChild(opts);

  menu.appendChild(el("p", { class: "note", id: "ts-note", hidden: "" }));
  wrap.appendChild(menu);
  root.appendChild(wrap);

  const $ = (s) => root.querySelector(s);
  const note = $("#ts-note");
  const say = (t) => {
    note.textContent = t || "";
    note.hidden = !t;
  };

  /* ---------- toolbar button (page DOM, styled by the viewer) ---------- */

  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "ts-open-btn";
  btn.className = "v-btn ghost";
  const bi = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  bi.setAttribute("class", "vi");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", "#v-ext");
  bi.appendChild(use);
  btn.appendChild(bi);
  btn.appendChild(el("span", null, "Open with Tab Share"));

  let menuOpen = false;
  function positionMenu() {
    const r = btn.getBoundingClientRect();
    menu.style.top = Math.round(r.bottom + 6) + "px";
    menu.style.right = Math.round(window.innerWidth - r.right) + "px";
  }
  function openMenu() {
    positionMenu();
    menu.hidden = false;
    menuOpen = true;
  }
  function closeMenu() {
    menu.hidden = true;
    $("#ts-save-row").hidden = true;
    say("");
    menuOpen = false;
  }
  function flashDone(text) {
    btn.querySelector("span").textContent = text || "Opened ✓";
    setTimeout(() => {
      const s = btn.querySelector("span");
      if (s) s.textContent = "Open with Tab Share";
    }, 2500);
  }
  function teardown() {
    btn.remove();
    host.remove();
  }

  /* ---------- storage ---------- */

  async function getConfig() {
    try {
      const s = await api.storage.local.get(["import.disabled", "import.default", "import.noauto"]);
      return {
        disabled: !!s["import.disabled"],
        deflt: s["import.default"] || "",
        noauto: !!s["import.noauto"],
      };
    } catch (e) {
      return { disabled: false, deflt: "", noauto: false };
    }
  }
  const setConfig = (patch) => {
    try {
      api.storage.local.set(patch);
    } catch (e) {}
  };

  /* ---------- actions ---------- */

  async function send(mode, title) {
    say("Working…");
    if ($("#ts-cb-remember").checked && mode !== "save") setConfig({ "import.default": mode });
    try {
      const res = await api.runtime.sendMessage({ type: "ts-import", mode, collection, title });
      if (res && res.ok) {
        closeMenu();
        flashDone(mode === "history" ? "Saved ✓" : "Opened ✓");
        if (res.note) {
          openMenu();
          say(res.note);
        }
      } else {
        say((res && res.error) || "Could not complete that.");
      }
    } catch (e) {
      say("Could not reach the extension.");
    }
  }

  btn.addEventListener("click", (e) => {
    if (!e.isTrusted) return;
    menuOpen ? closeMenu() : openMenu();
  });

  $(".acts").addEventListener("click", (e) => {
    if (!e.isTrusted) return;
    const b = e.target.closest("button[data-mode]");
    if (!b) return;
    const mode = b.dataset.mode;
    if (mode === "save") {
      $("#ts-save-title").value = collection.title || "";
      $("#ts-save-row").hidden = false;
      $("#ts-save-title").focus();
      $("#ts-save-title").select();
      return;
    }
    send(mode);
  });
  $("#ts-save-go").addEventListener("click", (e) => {
    if (!e.isTrusted) return;
    send("history", ($("#ts-save-title").value || "").trim());
  });
  $("#ts-cb-auto").addEventListener("change", (e) => {
    if (!e.isTrusted) return;
    setConfig({ "import.noauto": !e.target.checked });
  });
  $("#ts-hide").addEventListener("click", (e) => {
    if (!e.isTrusted) return;
    setConfig({ "import.disabled": true });
    unmountButton();
    if (settingsCb) settingsCb.checked = false;
  });
  document.addEventListener("click", (e) => {
    if (!menuOpen) return;
    if (e.target === btn || e.target.closest("#ts-open-btn")) return;
    closeMenu();
  });
  window.addEventListener("resize", () => {
    if (menuOpen) positionMenu();
  });

  /* ---------- mount / unmount the toolbar button ---------- */

  let mounted = false;
  function mountButton(withAuto) {
    if (mounted) return;
    const tools = document.querySelector(".v-tools");
    if (!tools) return;
    tools.insertBefore(btn, tools.firstChild);
    document.documentElement.appendChild(host);
    mounted = true;
    if (withAuto) autoOpen();
  }
  function unmountButton() {
    closeMenu();
    btn.remove();
    host.remove();
    mounted = false;
  }
  function teardown() {
    unmountButton();
  }

  function autoOpen() {
    getConfig().then((cfg) => {
      $("#ts-cb-auto").checked = !cfg.noauto;
      let autoDone = false;
      try {
        autoDone = !!sessionStorage.getItem(K.auto);
      } catch (e) {}
      if (autoDone) return;
      try {
        sessionStorage.setItem(K.auto, "1");
      } catch (e) {}
      if (cfg.deflt && cfg.deflt !== "save") return send(cfg.deflt);
      if (!cfg.noauto) setTimeout(openMenu, 400);
    });
  }

  /* ---------- reversible "Show the button" checkbox in the viewer ⚙ menu ---------- */

  let settingsCb = null;
  function addSettingsToggle(disabled) {
    const menu = document.getElementById("settings-menu");
    if (!menu || menu.querySelector("#ts-show-btn")) return;
    const lbl = document.createElement("label");
    lbl.className = "v-menu-check";
    settingsCb = document.createElement("input");
    settingsCb.type = "checkbox";
    settingsCb.id = "ts-show-btn";
    settingsCb.checked = !disabled;
    const span = document.createElement("span");
    span.textContent = "Show the “Open with Tab Share” button";
    lbl.append(settingsCb, span);
    menu.appendChild(lbl);
    settingsCb.addEventListener("change", (e) => {
      if (!e.isTrusted) return;
      if (settingsCb.checked) {
        setConfig({ "import.disabled": false });
        mountButton(false);
      } else {
        setConfig({ "import.disabled": true });
        unmountButton();
      }
    });
  }

  /* ---------- boot ---------- */

  (async function boot() {
    const cfg = await getConfig();
    addSettingsToggle(cfg.disabled);
    if (!cfg.disabled) mountButton(true);
  })();

  // Keep in sync if the options page toggles it.
  if (api.storage && api.storage.onChanged) {
    api.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes["import.disabled"]) return;
      const disabled = !!changes["import.disabled"].newValue;
      if (settingsCb) settingsCb.checked = !disabled;
      if (disabled) unmountButton();
      else mountButton(false);
    });
  }
})();
