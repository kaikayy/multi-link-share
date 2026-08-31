/* Tab Share — popup logic. No network, no content scripts. */
(function () {
  "use strict";

  const api = globalThis.browser && globalThis.browser.runtime ? globalThis.browser : globalThis.chrome;
  const CFG = globalThis.TabShareConfig;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /** @type {{source:string, pages:Array<{url:string,title:string,checked:boolean}>, name:string}} */
  const state = { source: "window", pages: [], name: "" };

  /* ---------- helpers ---------- */

  const isWebUrl = (u) => typeof u === "string" && /^https?:\/\//i.test(u);

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (el.hidden = true), 1800);
  }

  function dedupe(pages) {
    const seen = new Set();
    return pages.filter((p) => {
      if (seen.has(p.url)) return false;
      seen.add(p.url);
      return true;
    });
  }

  async function getViewerBase() {
    try {
      const { viewerBase } = await api.storage.local.get("viewerBase");
      const val = (viewerBase || CFG.DEFAULT_VIEWER_BASE || "").trim();
      return val.endsWith("/") ? val : val + "/";
    } catch (e) {
      return CFG.DEFAULT_VIEWER_BASE;
    }
  }

  /* ---------- data sources ---------- */

  async function queryWindowTabs() {
    const tabs = await api.tabs.query({ currentWindow: true });
    return tabs
      .filter((t) => isWebUrl(t.url))
      .map((t) => ({ url: t.url, title: t.title || "", checked: true, groupId: t.groupId }));
  }

  function hasTabGroupsApi() {
    return !!(api.tabGroups && typeof api.tabGroups.query === "function");
  }

  async function hasTabGroupsPermission() {
    try {
      return await api.permissions.contains({ permissions: ["tabGroups"] });
    } catch (e) {
      return false;
    }
  }

  async function loadWindowSource() {
    state.pages = dedupe(await queryWindowTabs());
    if (!state.name) {
      const win = await api.windows.getCurrent();
      state.name = "";
      void win;
    }
    render();
  }

  async function refreshGroupPanel() {
    const needsPerm = $("#group-needs-perm");
    const unsupported = $("#group-unsupported");
    const pickerWrap = $("#group-picker-wrap");
    needsPerm.hidden = true;
    unsupported.hidden = true;
    pickerWrap.hidden = true;

    if (!hasTabGroupsApi()) {
      unsupported.hidden = false;
      return;
    }
    if (!(await hasTabGroupsPermission())) {
      needsPerm.hidden = false;
      return;
    }
    await populateGroups();
  }

  async function populateGroups() {
    const pickerWrap = $("#group-picker-wrap");
    const picker = $("#group-picker");
    const win = await api.windows.getCurrent();
    let groups = [];
    try {
      groups = await api.tabGroups.query({ windowId: win.id });
    } catch (e) {
      groups = [];
    }
    if (!groups.length) {
      $("#group-unsupported").hidden = false;
      $("#group-unsupported").textContent =
        "No tab groups in this window. Create one from the browser's tab strip, then reopen this popup.";
      return;
    }
    picker.innerHTML = "";
    groups.forEach((g) => {
      const opt = document.createElement("option");
      opt.value = String(g.id);
      opt.textContent = (g.title && g.title.trim()) || `Group (${g.color || "untitled"})`;
      picker.appendChild(opt);
    });
    pickerWrap.hidden = false;

    // Preselect the group of the active tab, if any.
    const [active] = await api.tabs.query({ active: true, currentWindow: true });
    if (active && active.groupId != null && active.groupId >= 0) {
      picker.value = String(active.groupId);
    }
    await loadGroup(Number(picker.value));
  }

  async function loadGroup(groupId) {
    const tabs = await api.tabs.query({ groupId });
    state.pages = dedupe(
      tabs.filter((t) => isWebUrl(t.url)).map((t) => ({ url: t.url, title: t.title || "", checked: true }))
    );
    try {
      const g = await api.tabGroups.get(groupId);
      if (g && g.title && !state.name) {
        state.name = g.title;
        $("#collection-name").value = g.title;
      }
    } catch (e) {
      /* ignore */
    }
    render();
  }

  /* ---------- paste source ---------- */

  function parsePasteBox(merge) {
    const raw = $("#paste-box").value;
    const found = [];
    raw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((token) => {
        let candidate = token;
        if (!/^[a-z]+:\/\//i.test(candidate) && /\.[a-z]{2,}/i.test(candidate)) {
          candidate = "https://" + candidate;
        }
        const clean = ShareCodec.sanitizeUrl(candidate);
        if (clean) found.push({ url: clean, title: "", checked: true });
      });

    if (!found.length) {
      showError("No valid http(s) links found in the box.");
      return;
    }
    state.pages = dedupe(merge ? state.pages.concat(found) : found);
    $("#paste-box").value = "";
    clearError();
    render();
  }

  /* ---------- rendering ---------- */

  function showError(msg) {
    const el = $("#build-error");
    el.textContent = msg;
    el.hidden = false;
  }
  function clearError() {
    $("#build-error").hidden = true;
  }

  function render() {
    const list = $("#page-list");
    const tpl = $("#tpl-page-row");
    list.innerHTML = "";

    state.pages.forEach((page, idx) => {
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.dataset.idx = String(idx);
      node.classList.toggle("off", !page.checked);

      const cb = $("input[type=checkbox]", node);
      cb.checked = page.checked;
      cb.addEventListener("change", () => {
        state.pages[idx].checked = cb.checked;
        node.classList.toggle("off", !cb.checked);
        updateCount();
      });

      const m = Monogram.forUrl(page.url);
      const mono = $(".mono", node);
      mono.textContent = m.label;
      mono.style.background = m.bg;

      let host = "";
      try {
        host = new URL(page.url).host;
      } catch (e) {}
      $(".p-title", node).textContent = page.title || host || page.url;
      $(".p-host", node).textContent = host;

      $(".reorder", node).addEventListener("click", (ev) => {
        const btn = ev.target.closest("button[data-act]");
        if (!btn) return;
        const act = btn.dataset.act;
        if (act === "remove") state.pages.splice(idx, 1);
        if (act === "up" && idx > 0) [state.pages[idx - 1], state.pages[idx]] = [state.pages[idx], state.pages[idx - 1]];
        if (act === "down" && idx < state.pages.length - 1)
          [state.pages[idx + 1], state.pages[idx]] = [state.pages[idx], state.pages[idx + 1]];
        render();
      });

      list.appendChild(node);
    });

    $("#list-empty").hidden = state.pages.length > 0;
    updateCount();
  }

  function selectedPages() {
    return state.pages.filter((p) => p.checked);
  }

  function updateCount() {
    const n = selectedPages().length;
    $("#count-label").textContent = `${n} page${n === 1 ? "" : "s"} selected`;
    $("#create-link").disabled = n === 0;
  }

  /* ---------- create link ---------- */

  async function createLink() {
    clearError();
    const pages = selectedPages().map((p) => ({ u: p.url, t: p.title }));
    if (!pages.length) return;

    let token;
    try {
      token = ShareCodec.encode({ title: $("#collection-name").value, pages });
    } catch (e) {
      showError(e.message || "Could not build the link.");
      return;
    }

    const base = await getViewerBase();
    const link = base + "#" + token;

    await saveRecent(link, $("#collection-name").value, pages.length);
    showResult(link, $("#collection-name").value, pages.length);
  }

  function showResult(link, name, count) {
    $("#view-build").hidden = true;
    $("#foot-build").hidden = true;
    $("#view-result").hidden = false;

    $("#result-name").textContent = name || "Untitled collection";
    $("#result-sub").textContent = `${count} page${count === 1 ? "" : "s"} · opens as a slideshow, no extension needed`;
    $("#result-link").value = link;

    const warn = $("#len-warn");
    if (link.length > (CFG.SOFT_URL_LIMIT || 12000)) {
      warn.hidden = false;
      warn.textContent = `Heads up: this link is ${link.length.toLocaleString()} characters. It works in browsers, but some chat apps may shorten or break very long links. Consider sharing fewer pages.`;
    } else {
      warn.hidden = true;
    }

    $("#result-link").focus();
    $("#result-link").select();
    renderRecents();
  }

  async function copyLink() {
    const val = $("#result-link").value;
    try {
      await navigator.clipboard.writeText(val);
      toast("Link copied");
    } catch (e) {
      const inp = $("#result-link");
      inp.focus();
      inp.select();
      try {
        document.execCommand("copy");
        toast("Link copied");
      } catch (e2) {
        toast("Press Ctrl/Cmd+C to copy");
      }
    }
  }

  /* ---------- recents ---------- */

  async function saveRecent(link, name, count) {
    try {
      const { recents = [] } = await api.storage.local.get("recents");
      recents.unshift({ link, name: name || "Untitled", count, at: Date.now() });
      await api.storage.local.set({ recents: recents.slice(0, 8) });
    } catch (e) {}
  }

  async function renderRecents() {
    try {
      const { recents = [] } = await api.storage.local.get("recents");
      const box = $("#recents");
      const ul = $("#recents-list");
      if (!recents.length) {
        box.hidden = true;
        return;
      }
      box.hidden = false;
      ul.innerHTML = "";
      recents.forEach((r) => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = r.link;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = `${r.name} (${r.count})`;
        li.appendChild(a);
        ul.appendChild(li);
      });
    } catch (e) {}
  }

  /* ---------- source switching ---------- */

  async function setSource(source) {
    state.source = source;
    $$(".seg").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.source === source)));
    $("#panel-group").hidden = source !== "group";
    $("#panel-paste").hidden = source !== "paste";
    clearError();

    if (source === "window") await loadWindowSource();
    if (source === "group") await refreshGroupPanel();
    if (source === "paste") {
      // keep whatever is already in the list
      render();
    }
  }

  /* ---------- wire up ---------- */

  function init() {
    $("#open-options").addEventListener("click", () => api.runtime.openOptionsPage());

    $$(".seg").forEach((btn) => btn.addEventListener("click", () => setSource(btn.dataset.source)));

    $("#grant-groups").addEventListener("click", async () => {
      try {
        const granted = await api.permissions.request({ permissions: ["tabGroups"] });
        if (granted) await refreshGroupPanel();
        else toast("Permission not granted");
      } catch (e) {
        toast("This browser can't grant that permission");
      }
    });

    $("#group-picker").addEventListener("change", (e) => loadGroup(Number(e.target.value)));

    $("#paste-parse").addEventListener("click", () => parsePasteBox(true));
    $("#paste-add-window").addEventListener("click", async () => {
      const win = await queryWindowTabs();
      state.pages = dedupe(state.pages.concat(win));
      render();
      toast(`Added ${win.length} tab${win.length === 1 ? "" : "s"}`);
    });

    $("#select-all").addEventListener("click", () => {
      state.pages.forEach((p) => (p.checked = true));
      render();
    });
    $("#select-none").addEventListener("click", () => {
      state.pages.forEach((p) => (p.checked = false));
      render();
    });

    $("#collection-name").addEventListener("input", (e) => (state.name = e.target.value));

    $("#create-link").addEventListener("click", createLink);
    $("#copy-link").addEventListener("click", copyLink);
    $("#open-preview").addEventListener("click", () => {
      api.tabs.create({ url: $("#result-link").value });
    });
    $("#result-back").addEventListener("click", () => {
      $("#view-result").hidden = true;
      $("#view-build").hidden = false;
      $("#foot-build").hidden = false;
    });

    setSource("window").catch((e) => showError("Could not read this window's tabs: " + e.message));
  }

  document.addEventListener("DOMContentLoaded", init);
})();
