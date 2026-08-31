/* Tab Share — viewer-page import banner (content script).
 *
 * Runs only on the viewer page. If the URL fragment decodes to a real Tab Share
 * collection, offer to open it with the extension instead of the web view:
 * into this window, a new window, or a tab group — or save it to history.
 *
 * Everything lives in a shadow root so the viewer's strict CSP and styles never
 * touch it, and nothing here makes a network request. The markup is a constant
 * string; every dynamic value goes in through textContent.
 */
(function () {
  "use strict";

  const api = globalThis.browser && globalThis.browser.runtime ? globalThis.browser : globalThis.chrome;
  if (!api || !api.runtime || typeof ShareCodec === "undefined") return;

  const token = (location.hash || "").replace(/^#/, "").slice(0, 64);
  const dismissKey = "tabshare:dismiss:" + token;

  let collection = null;
  try {
    collection = ShareCodec.decode(location.hash);
  } catch (e) {
    collection = null;
  }
  if (!collection || !collection.pages || !collection.pages.length) return;

  try {
    if (sessionStorage.getItem(dismissKey)) return;
  } catch (e) {}

  const count = collection.pages.length;

  const CSS =
    ":host{all:initial}" +
    ".bar{pointer-events:auto;font:13px/1.4 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;" +
    "background:#1f1b2e;color:#f2f0ff;border:1px solid #38315c;border-radius:12px;" +
    "box-shadow:0 10px 34px rgba(0,0,0,.4);padding:12px 14px;max-width:560px;width:calc(100% - 24px);" +
    "display:flex;flex-direction:column;gap:10px}" +
    ".head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}" +
    ".head b{font-size:13.5px}.head span{color:#b7b0d8;font-size:12px}" +
    ".row{display:flex;flex-wrap:wrap;gap:6px}" +
    "button{font:inherit;cursor:pointer;border-radius:8px;padding:7px 11px;border:1px solid #4a4276;background:#2b2545;color:#f2f0ff}" +
    "button:hover{background:#362e57}" +
    "button.primary{background:#6d5efc;border-color:#6d5efc;color:#fff}button.primary:hover{filter:brightness(1.08)}" +
    "button.link{border:0;background:transparent;color:#b7b0d8;padding:7px 6px}button.link:hover{color:#f2f0ff;text-decoration:underline}" +
    ".save{display:flex;gap:6px}" +
    ".save input{font:inherit;flex:1;min-width:0;border-radius:8px;border:1px solid #4a4276;background:#16121f;color:#f2f0ff;padding:7px 9px}" +
    ".note{color:#b7b0d8;font-size:12px;margin:0}" +
    "[hidden]{display:none!important}";

  /** Build one element from a tag, attrs and text — no innerHTML anywhere. */
  function el(tag, attrs, text) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  const host = document.createElement("div");
  host.id = "tab-share-import-host";
  host.style.cssText =
    "all:initial;position:fixed;top:12px;left:0;right:0;z-index:2147483647;display:flex;justify-content:center;pointer-events:none";
  // Closed so the host page cannot reach in and synthesise clicks on the
  // action buttons (which would let it open tabs via the background worker
  // without the user actually clicking).
  const root = host.attachShadow({ mode: "closed" });

  root.appendChild(el("style", null, CSS));

  const bar = el("div", { class: "bar", role: "dialog", "aria-label": "Open with Tab Share" });

  const head = el("div", { class: "head" });
  head.appendChild(el("b", null, "Open with Tab Share?"));
  const sub = el("span", { id: "ts-sub" });
  head.appendChild(sub);
  bar.appendChild(head);

  const actions = el("div", { class: "row", id: "ts-actions" });
  actions.appendChild(el("button", { class: "primary", "data-mode": "this-window" }, "This window"));
  actions.appendChild(el("button", { "data-mode": "new-window" }, "New window"));
  actions.appendChild(el("button", { "data-mode": "tab-group" }, "Tab group"));
  actions.appendChild(el("button", { "data-mode": "save" }, "Save to history…"));
  actions.appendChild(el("button", { class: "link", id: "ts-dismiss" }, "Use the web view"));
  bar.appendChild(actions);

  const saveRow = el("div", { class: "save", id: "ts-save-row", hidden: "" });
  saveRow.appendChild(el("input", { id: "ts-save-title", type: "text", maxlength: "200" }));
  saveRow.appendChild(el("button", { class: "primary", id: "ts-save-go" }, "Save"));
  saveRow.appendChild(el("button", { class: "link", id: "ts-save-cancel" }, "Cancel"));
  bar.appendChild(saveRow);

  bar.appendChild(el("p", { class: "note", id: "ts-note", hidden: "" }));
  root.appendChild(bar);

  const $ = (s) => root.querySelector(s);

  $("#ts-sub").textContent =
    count + " page" + (count === 1 ? "" : "s") + (collection.title ? " · " + collection.title : "");

  document.documentElement.appendChild(host);

  const note = $("#ts-note");
  function say(text) {
    note.textContent = text || "";
    note.hidden = !text;
  }
  function remove() {
    host.remove();
  }

  async function send(mode, title) {
    say("Working…");
    try {
      const res = await api.runtime.sendMessage({ type: "ts-import", mode, collection, title });
      if (res && res.ok) {
        if (res.note) {
          say(res.note);
          setTimeout(remove, 3500);
        } else {
          remove();
        }
      } else {
        say((res && res.error) || "Could not complete that — try the web view.");
      }
    } catch (e) {
      say("Could not reach the extension — try the web view.");
    }
  }

  $("#ts-actions").addEventListener("click", async (e) => {
    if (!e.isTrusted) return; // ignore programmatic clicks from the host page
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
    if (mode === "tab-group") {
      let granted = true;
      try {
        granted = await api.permissions.request({ permissions: ["tabGroups"] });
      } catch (err) {
        granted = false;
      }
      if (!granted) {
        say("Tab groups need a one-time permission — not granted.");
        return;
      }
    }
    send(mode);
  });

  $("#ts-save-go").addEventListener("click", (e) => {
    if (!e.isTrusted) return;
    send("history", ($("#ts-save-title").value || "").trim());
  });
  $("#ts-save-cancel").addEventListener("click", (e) => {
    if (!e.isTrusted) return;
    $("#ts-save-row").hidden = true;
    say("");
  });
  $("#ts-dismiss").addEventListener("click", (e) => {
    if (!e.isTrusted) return;
    try {
      sessionStorage.setItem(dismissKey, "1");
    } catch (e2) {}
    remove();
  });
})();
