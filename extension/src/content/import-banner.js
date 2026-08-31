/* Tab Share — viewer-page import prompt (content script).
 *
 * Runs only on the viewer page. If the URL fragment decodes to a real Tab Share
 * collection, offer to open it with the extension instead of the web view:
 * into this window, a new window, or a tab group — or save it to history.
 *
 * UI lives in a CLOSED shadow root (the host page can't reach in and synthesise
 * clicks) and every handler checks `event.isTrusted`. No network requests. The
 * markup is built with createElement — no innerHTML.
 */
(function () {
  "use strict";

  const api = globalThis.browser && globalThis.browser.runtime ? globalThis.browser : globalThis.chrome;
  if (!api || !api.runtime || typeof ShareCodec === "undefined") return;

  const token = (location.hash || "").replace(/^#/, "").slice(0, 96);
  const K = {
    sessionDismiss: "tabshare:dismiss:" + token,
    sessionAuto: "tabshare:auto:" + token,
  };

  let collection = null;
  try {
    collection = ShareCodec.decode(location.hash);
  } catch (e) {
    collection = null;
  }
  // Encrypted links can't be pre-read; let the viewer's unlock screen handle it.
  if (!collection || collection.encrypted || !collection.pages || !collection.pages.length) return;

  const count = collection.pages.length;

  const CSS =
    ":host{all:initial}" +
    ".wrap{position:fixed;inset:0;display:grid;place-items:center;pointer-events:none}" +
    ".card{pointer-events:auto;font:13px/1.45 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;" +
    "background:#1f1b2e;color:#f2f0ff;border:1px solid #38315c;border-radius:16px;" +
    "box-shadow:0 24px 70px rgba(0,0,0,.5);padding:18px 20px;max-width:460px;width:calc(100% - 32px);" +
    "display:flex;flex-direction:column;gap:12px}" +
    ".head b{font-size:15px;display:block}.head span{color:#b7b0d8;font-size:12.5px}" +
    ".row{display:flex;flex-wrap:wrap;gap:7px}" +
    "button{font:inherit;cursor:pointer;border-radius:9px;padding:8px 12px;border:1px solid #4a4276;background:#2b2545;color:#f2f0ff}" +
    "button:hover{background:#362e57}" +
    "button.primary{background:#6d5efc;border-color:#6d5efc;color:#fff}button.primary:hover{filter:brightness(1.08)}" +
    "button.link{border:0;background:transparent;color:#b7b0d8;padding:6px 4px}button.link:hover{color:#f2f0ff;text-decoration:underline}" +
    ".save{display:flex;gap:6px}" +
    ".save input{font:inherit;flex:1;min-width:0;border-radius:8px;border:1px solid #4a4276;background:#16121f;color:#f2f0ff;padding:8px 10px}" +
    ".opts{display:flex;flex-direction:column;gap:6px;border-top:1px solid #38315c;padding-top:10px}" +
    ".opts label{display:flex;gap:8px;align-items:center;color:#cfc9e8;font-size:12.5px;cursor:pointer}" +
    ".foot{display:flex;justify-content:space-between;align-items:center;gap:8px}" +
    ".note{color:#b7b0d8;font-size:12px;margin:0}" +
    ".pill{pointer-events:auto;position:fixed;top:12px;right:12px;font:600 12.5px system-ui,sans-serif;" +
    "background:#2b2545;color:#f2f0ff;border:1px solid #4a4276;border-radius:999px;padding:7px 13px;cursor:pointer;" +
    "box-shadow:0 6px 20px rgba(0,0,0,.35)}" +
    ".pill:hover{background:#362e57}" +
    "[hidden]{display:none!important}";

  function el(tag, attrs, text) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  const host = document.createElement("div");
  host.id = "tab-share-import-host";
  host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none";
  const root = host.attachShadow({ mode: "closed" });
  root.appendChild(el("style", null, CSS));

  /* ---- card ---- */
  const wrap = el("div", { class: "wrap" });
  const card = el("div", { class: "card", role: "dialog", "aria-label": "Open with Tab Share" });

  const head = el("div", { class: "head" });
  head.appendChild(el("b", null, "Open with Tab Share?"));
  head.appendChild(
    el(
      "span",
      null,
      count + " page" + (count === 1 ? "" : "s") + (collection.title ? " · " + collection.title : "")
    )
  );
  card.appendChild(head);

  const actions = el("div", { class: "row", id: "ts-actions" });
  actions.appendChild(el("button", { class: "primary", "data-mode": "this-window" }, "This window"));
  actions.appendChild(el("button", { "data-mode": "new-window" }, "New window"));
  actions.appendChild(el("button", { "data-mode": "tab-group" }, "Tab group"));
  actions.appendChild(el("button", { "data-mode": "save" }, "Save to history…"));
  card.appendChild(actions);

  const saveRow = el("div", { class: "save", id: "ts-save-row", hidden: "" });
  saveRow.appendChild(el("input", { id: "ts-save-title", type: "text", maxlength: "200", placeholder: "Title for history" }));
  saveRow.appendChild(el("button", { class: "primary", id: "ts-save-go" }, "Save"));
  saveRow.appendChild(el("button", { class: "link", id: "ts-save-cancel" }, "Cancel"));
  card.appendChild(saveRow);

  const opts = el("div", { class: "opts" });
  const cbNever = el("input", { type: "checkbox", id: "ts-cb-never" });
  const lblNever = el("label");
  lblNever.appendChild(cbNever);
  lblNever.appendChild(el("span", null, "Don't show this again"));
  const cbRemember = el("input", { type: "checkbox", id: "ts-cb-remember" });
  const lblRemember = el("label");
  lblRemember.appendChild(cbRemember);
  lblRemember.appendChild(el("span", null, "Remember my choice as the default"));
  opts.appendChild(lblNever);
  opts.appendChild(lblRemember);
  card.appendChild(opts);

  const foot = el("div", { class: "foot" });
  foot.appendChild(el("p", { class: "note", id: "ts-note", hidden: "" }));
  foot.appendChild(el("button", { class: "link", id: "ts-dismiss" }, "Use the web view"));
  card.appendChild(foot);

  wrap.appendChild(card);
  root.appendChild(wrap);

  /* ---- reopen pill ---- */
  const pill = el("button", { class: "pill", id: "ts-pill", hidden: "" }, "⧉ Open with Tab Share");
  root.appendChild(pill);

  const $ = (s) => root.querySelector(s);
  const note = $("#ts-note");
  const say = (t) => {
    note.textContent = t || "";
    note.hidden = !t;
  };

  function showCard() {
    wrap.hidden = false;
    pill.hidden = true;
  }
  function showPill() {
    wrap.hidden = true;
    pill.hidden = false;
  }
  function teardown() {
    host.remove();
  }

  /* ---- storage ---- */
  async function getConfig() {
    try {
      const s = await api.storage.local.get(["import.disabled", "import.default"]);
      return { disabled: !!s["import.disabled"], deflt: s["import.default"] || "" };
    } catch (e) {
      return { disabled: false, deflt: "" };
    }
  }
  function setConfig(patch) {
    try {
      api.storage.local.set(patch);
    } catch (e) {}
  }

  /* ---- actions ---- */
  async function send(mode, title) {
    say("Working…");
    try {
      const res = await api.runtime.sendMessage({ type: "ts-import", mode, collection, title });
      if (res && res.ok) {
        if (res.note) {
          say(res.note);
          setTimeout(teardown, 3500);
        } else {
          teardown();
        }
      } else {
        say((res && res.error) || "Could not complete that — try the web view.");
      }
    } catch (e) {
      say("Could not reach the extension — try the web view.");
    }
  }

  function applyRememberAndNever(mode) {
    if ($("#ts-cb-never").checked) setConfig({ "import.disabled": true });
    if ($("#ts-cb-remember").checked && mode !== "save") setConfig({ "import.default": mode });
  }

  $("#ts-actions").addEventListener("click", (e) => {
    if (!e.isTrusted) return;
    const btn = e.target.closest("button[data-mode]");
    if (!btn) return;
    const mode = btn.dataset.mode;
    if (mode === "save") {
      $("#ts-save-title").value = collection.title || "";
      $("#ts-save-row").hidden = false;
      $("#ts-save-title").focus();
      $("#ts-save-title").select();
      return;
    }
    applyRememberAndNever(mode);
    send(mode);
  });

  $("#ts-save-go").addEventListener("click", (e) => {
    if (!e.isTrusted) return;
    applyRememberAndNever("save");
    send("history", ($("#ts-save-title").value || "").trim());
  });
  $("#ts-save-cancel").addEventListener("click", (e) => {
    if (!e.isTrusted) return;
    $("#ts-save-row").hidden = true;
    say("");
  });
  $("#ts-dismiss").addEventListener("click", (e) => {
    if (!e.isTrusted) return;
    if ($("#ts-cb-never").checked) {
      setConfig({ "import.disabled": true });
      teardown();
      return;
    }
    try {
      sessionStorage.setItem(K.sessionDismiss, "1");
    } catch (e2) {}
    showPill();
  });
  pill.addEventListener("click", (e) => {
    if (!e.isTrusted) return;
    try {
      sessionStorage.removeItem(K.sessionDismiss);
    } catch (e2) {}
    showCard();
  });

  /* ---- boot ---- */
  (async function boot() {
    const { disabled, deflt } = await getConfig();
    if (disabled) return; // inject nothing

    document.documentElement.appendChild(host);

    let autoDone = false;
    try {
      autoDone = !!sessionStorage.getItem(K.sessionAuto);
    } catch (e) {}

    if (deflt && deflt !== "save" && !autoDone) {
      try {
        sessionStorage.setItem(K.sessionAuto, "1");
      } catch (e) {}
      showCard(); // flashes "Working…" then tears down (or shows an error)
      send(deflt);
      return;
    }

    let dismissed = false;
    try {
      dismissed = !!sessionStorage.getItem(K.sessionDismiss);
    } catch (e) {}
    if (dismissed) showPill();
    else showCard();
  })();
})();
