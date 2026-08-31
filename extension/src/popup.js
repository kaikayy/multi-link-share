/* Tab Share — popup logic. The only network call is the optional URL shortener
   (off by default; see options). */
(function () {
  "use strict";

  const api = globalThis.browser && globalThis.browser.runtime ? globalThis.browser : globalThis.chrome;
  const CFG = globalThis.TabShareConfig;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const state = {
    source: "window",
    pages: [],
    name: "",
    groupPristine: true, // true = a picker change may replace the list wholesale
    settings: { showIcons: true, autoPreview: true, shortProvider: "", shortEndpoint: "", shortAuto: false },
  };

  async function loadSettings() {
    try {
      const s = await api.storage.local.get(["showIcons", "autoPreview", "shortProvider", "shortEndpoint", "shortAuto"]);
      // is.gd / v.gd reject '#'-fragment and github.io URLs, so they never worked
      // for share links — retired in favour of TinyURL / a custom endpoint.
      const provider = s.shortProvider === "isgd" || s.shortProvider === "vgd" ? "" : s.shortProvider || "";
      state.settings = {
        showIcons: s.showIcons === true, // default OFF
        autoPreview: s.autoPreview !== false,
        shortProvider: provider,
        shortEndpoint: s.shortEndpoint || "",
        shortAuto: !!s.shortAuto,
      };
    } catch (e) {}
  }

  /* ---------- helpers ---------- */

  const isWebUrl = (u) => typeof u === "string" && /^https?:\/\//i.test(u);
  const safeIcon = (u) => typeof u === "string" && /^(https?:|data:)/i.test(u);

  /** Local-time "YYYY-MM-DD-HH:MM", the fallback name for an untitled collection. */
  function defaultTitle(d = new Date()) {
    const p = (n) => String(n).padStart(2, "0");
    return (
      `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
      `-${p(d.getHours())}:${p(d.getMinutes())}`
    );
  }

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

  function tabToPage(t) {
    return { url: t.url, title: t.title || "", checked: true, groupId: t.groupId, favIconUrl: t.favIconUrl };
  }

  async function queryWindowTabs(q) {
    const tabs = await api.tabs.query(q || { currentWindow: true });
    return tabs.filter((t) => isWebUrl(t.url)).map(tabToPage);
  }

  function hasTabGroupsApi() {
    return !!(api.tabGroups && typeof api.tabGroups.query === "function");
  }

  /** Populate the window picker; show it only when >1 normal window is open. */
  async function populateWindows() {
    const picker = $("#window-picker");
    const wrap = $("#window-picker-wrap");
    let wins = [];
    try {
      wins = (await api.windows.getAll({ populate: true, windowTypes: ["normal"] })) || [];
    } catch (e) {
      wins = [];
    }
    if (wins.length <= 1) {
      wrap.hidden = true;
      $("#panel-window").hidden = true; // nothing to choose — don't show an empty panel
      return;
    }
    const cur = await api.windows.getCurrent();
    picker.innerHTML = "";
    const opt = (v, label) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = label;
      picker.appendChild(o);
    };
    opt("current", "This window");
    opt("all", `All windows (${wins.length})`);
    let n = 0;
    wins.forEach((w) => {
      n += 1;
      if (w.id === cur.id) return;
      const webCount = (w.tabs || []).filter((t) => isWebUrl(t.url)).length;
      opt(String(w.id), `Window ${n} · ${webCount} tab${webCount === 1 ? "" : "s"}`);
    });
    wrap.hidden = false;
    $("#panel-window").hidden = false;
  }

  async function loadWindowSource() {
    const sel = ($("#window-picker") && $("#window-picker").value) || "current";
    let q = { currentWindow: true };
    if (sel === "all") q = { windowType: "normal" };
    else if (/^\d+$/.test(sel)) q = { windowId: Number(sel) };
    state.pages = dedupe(await queryWindowTabs(q));
    state.groupPristine = false;
    render();
  }

  async function refreshGroupPanel(keepList) {
    const unsupported = $("#group-unsupported");
    const pickerWrap = $("#group-picker-wrap");
    unsupported.hidden = true;
    pickerWrap.hidden = true;

    if (!hasTabGroupsApi()) {
      unsupported.hidden = false;
      unsupported.textContent =
        "This browser doesn't have a tab-group API. Use Windows or Paste Links instead.";
      return;
    }
    await populateGroups(keepList);
  }

  async function populateGroups(keepList) {
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
    if (keepList) {
      render(); // a restored list wins — don't replace it with a group preview
      return;
    }
    state.groupPristine = true;
    await loadGroup(Number(picker.value));
  }

  async function groupTabs(groupId) {
    const tabs = await api.tabs.query({ groupId });
    return tabs
      .filter((t) => isWebUrl(t.url))
      .map((t) => ({ url: t.url, title: t.title || "", checked: true, favIconUrl: t.favIconUrl }));
  }

  async function groupTitle(groupId) {
    try {
      const g = await api.tabGroups.get(groupId);
      return (g && g.title && g.title.trim()) || "";
    } catch (e) {
      return "";
    }
  }

  /** Preview one group — replaces the list. Only runs while the list is pristine.
      Merely browsing groups never touches the name field (not even its placeholder). */
  async function loadGroup(groupId) {
    state.pages = dedupe(await groupTabs(groupId));
    state.groupPristine = true;
    render();
  }

  /** Append the picked group's tabs — combines groups. The first group actively
      added seeds the collection name (if the user hasn't typed one). */
  async function addGroup(groupId) {
    const before = state.pages.length;
    state.pages = dedupe(state.pages.concat(await groupTabs(groupId)));
    state.groupPristine = false;
    render();
    const added = state.pages.length - before;

    const gt = await groupTitle(groupId);
    const nameEl = $("#collection-name");
    if (gt && !nameEl.value.trim()) {
      nameEl.value = gt;
      state.name = gt;
      saveNameDraft();
    }
    toast(added > 0 ? `Added ${added} tab${added === 1 ? "" : "s"}` : "That group's tabs are already in the list");
  }

  /* ---------- paste source ---------- */

  // Draft persistence — the paste box, the collection name and the active source
  // tab all survive a popup close/reopen or a tab switch.
  const draftStore = (api.storage && api.storage.session) || (api.storage && api.storage.local);

  async function loadDrafts() {
    try {
      const s = await draftStore.get(["pasteDraft", "nameDraft", "source", "pagesDraft"]);
      if (s.pasteDraft) $("#paste-box").value = s.pasteDraft;
      if (s.nameDraft) {
        $("#collection-name").value = s.nameDraft;
        state.name = s.nameDraft;
      }
      if (s.source) state.source = s.source;
      if (Array.isArray(s.pagesDraft) && s.pagesDraft.length) {
        state.pages = s.pagesDraft
          .filter((p) => p && isWebUrl(p.url))
          .map((p) => ({ url: p.url, title: p.title || "", checked: p.checked !== false }));
      }
    } catch (e) {}
  }
  function savePasteDraft() {
    try {
      draftStore.set({ pasteDraft: $("#paste-box").value });
    } catch (e) {}
  }
  function clearPasteDraft() {
    $("#paste-box").value = "";
    try {
      draftStore.remove("pasteDraft");
    } catch (e) {}
  }
  function saveNameDraft() {
    try {
      draftStore.set({ nameDraft: $("#collection-name").value });
    } catch (e) {}
  }
  function savePagesDraft() {
    try {
      draftStore.set({
        pagesDraft: state.pages.map((p) => ({ url: p.url, title: p.title || "", checked: p.checked !== false })),
      });
    } catch (e) {}
  }
  function clearDrafts() {
    try {
      draftStore.remove(["nameDraft", "pasteDraft", "pagesDraft"]);
    } catch (e) {}
  }

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

    const before = state.pages.length;
    if (found.length) state.pages = dedupe(merge ? state.pages.concat(found) : found);
    state.groupPristine = false;
    clearPasteDraft(); // always empty the box — anything left couldn't be added
    clearError();
    render();
    const added = state.pages.length - before;
    if (!found.length) toast("No valid links — cleared the box");
    else toast(added > 0 ? `Added ${added} link${added === 1 ? "" : "s"}` : "Those links are already in the list");
  }

  async function fillPasteBox() {
    const tabs = await queryWindowTabs();
    if (!tabs.length) {
      toast("No web pages open in this window");
      return;
    }
    const box = $("#paste-box");
    const existing = box.value.trim();
    const urls = tabs.map((t) => t.url).join("\n");
    box.value = existing ? existing + "\n" + urls : urls;
    savePasteDraft();
    box.focus();
    toast(`Loaded ${tabs.length} URL${tabs.length === 1 ? "" : "s"} — edit, then Add`);
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
      if (state.settings.showIcons && safeIcon(page.favIconUrl)) {
        const img = document.createElement("img");
        img.className = "fav"; // opaque, covers the monogram; removed on error
        img.alt = "";
        img.referrerPolicy = "no-referrer";
        img.src = page.favIconUrl;
        img.addEventListener("error", () => img.remove());
        mono.appendChild(img);
      }

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
        state.groupPristine = false; // curated — don't let a picker change wipe it
        render();
      });

      list.appendChild(node);
    });

    $("#list-empty").hidden = state.pages.length > 0;
    updateCount();
    savePagesDraft();
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

  let lastLongLink = "";

  async function createLink() {
    clearError();
    const pages = selectedPages().map((p) => ({ u: p.url, t: p.title }));
    if (!pages.length) return;

    const name = ($("#collection-name").value || "").trim() || defaultTitle();
    const flags = (state.settings.showIcons ? 1 : 0) | (state.settings.autoPreview ? 2 : 0);
    const password = $("#protect").checked ? $("#link-pass").value : "";
    if ($("#protect").checked && !password) {
      showError("Enter a password, or turn off protection.");
      return;
    }

    let token;
    try {
      token = ShareCodec.encode({ title: name, pages, flags });
      if (password) token = await ShareCodec.encrypt(token, password);
    } catch (e) {
      showError(e.message || "Could not build the link.");
      return;
    }

    const base = await getViewerBase();
    let link = base + "#" + token;
    lastLongLink = link;

    let shortenNote = "";
    if (state.settings.shortProvider && state.settings.shortAuto) {
      try {
        link = await shorten(lastLongLink);
      } catch (e) {
        shortenNote = "Couldn't shorten this link — " + (e.message || "the shortener failed") + ". The full link is below.";
        link = lastLongLink;
      }
    }

    await saveRecent(link, name, pages.length);
    clearDrafts();
    // the link is done — "Build another" starts from a clean name (pages are kept
    // so a quick variant is easy), and a fresh popup open won't resurrect this one
    $("#collection-name").value = "";
    state.name = "";
    $("#protect").checked = false;
    $("#pw-field").hidden = true;
    $("#link-pass").value = "";
    showResult(link, name, pages.length, !!password, shortenNote);
    autoCopy(link);
  }

  /** Extract a short URL from a text or JSON shortener response. */
  function pickShortUrl(body) {
    body = String(body || "").trim();
    if (/^https?:\/\/\S+$/i.test(body)) return body;
    try {
      const j = JSON.parse(body);
      const cand = j.shorturl || j.short_url || j.shortUrl || j.short || j.url || j.link || (j.result && j.result.full_short_link);
      if (typeof cand === "string" && /^https?:\/\//i.test(cand)) return cand.trim();
    } catch (e) {}
    return "";
  }

  async function shorten(longUrl) {
    const p = state.settings.shortProvider;
    const enc = encodeURIComponent(longUrl);
    let url;
    if (p === "tinyurl") url = `https://tinyurl.com/api-create.php?url=${enc}`;
    else if (p === "custom" && state.settings.shortEndpoint) url = state.settings.shortEndpoint + enc;
    else throw new Error("no shortener is set up — see the options page");

    let res;
    try {
      res = await fetch(url, { headers: { Accept: "text/plain, application/json" } });
    } catch (e) {
      throw new Error("the shortener couldn’t be reached (offline, or the options page never got host access)");
    }
    if (!res.ok) throw new Error("the shortener returned HTTP " + res.status);

    const short = pickShortUrl(await res.text());
    if (!short) throw new Error("the shortener returned no link (it may reject long or '#'-fragment URLs)");
    if (short.length >= longUrl.length) throw new Error("the shortened link came back no shorter than the original");
    return short;
  }

  async function autoCopy(link) {
    try {
      await navigator.clipboard.writeText(link);
      toast("Link created — copied to clipboard");
    } catch (e) {
      toast("Link created — press Copy to put it on the clipboard");
    }
  }

  function showResult(link, name, count, encrypted, shortenNote) {
    $("#view-build").hidden = true;
    $("#foot-build").hidden = true;
    $("#view-result").hidden = false;

    $("#result-name").textContent = name || "Untitled collection";
    $("#result-sub").textContent = `${count} page${count === 1 ? "" : "s"} · opens as a slideshow, no extension needed`;
    $("#result-link").value = link;
    $("#pw-note").hidden = !encrypted;

    // A shortener is configured and we're still on the long link — offer the
    // button (whether auto-shorten is off, or it's on but just failed).
    const showShorten = !!state.settings.shortProvider && link === lastLongLink;
    $("#shorten-row").hidden = !showShorten;
    $("#shorten-link").hidden = false;
    $("#shorten-link").textContent = shortenNote ? "Try shortening again" : "Shorten link";
    $("#show-original").hidden = true;

    const warn = $("#len-warn");
    if (shortenNote) {
      warn.hidden = false;
      warn.textContent = shortenNote;
    } else if (link.length > (CFG.SOFT_URL_LIMIT || 12000)) {
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

  const HISTORY_CAP = 50;

  async function saveRecent(link, name, count) {
    try {
      const { recents = [] } = await api.storage.local.get("recents");
      const at = Date.now();
      recents.unshift({ id: String(at), link, name: name || "Untitled", count, at });
      await api.storage.local.set({ recents: recents.slice(0, HISTORY_CAP) });
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

  async function setSource(source, keepList) {
    state.source = source;
    try {
      draftStore.set({ source });
    } catch (e) {}
    $$(".seg").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.source === source)));
    $("#panel-window").hidden = source !== "window";
    $("#panel-group").hidden = source !== "group";
    $("#panel-paste").hidden = source !== "paste";
    clearError();

    if (source === "window") {
      await populateWindows();
      if (keepList) render();
      else await loadWindowSource();
    }
    if (source === "group") await refreshGroupPanel(keepList);
    if (source === "paste") render(); // keep whatever is already in the list
  }

  /* ---------- wire up ---------- */

  function init() {
    $("#open-options").addEventListener("click", () => api.runtime.openOptionsPage());

    $$(".seg").forEach((btn) => btn.addEventListener("click", () => setSource(btn.dataset.source)));

    $("#group-picker").addEventListener("change", (e) => {
      const id = Number(e.target.value);
      if (state.groupPristine) {
        loadGroup(id);
      } else {
        $("#group-hint").hidden = false; // list is curated — pick + ＋ Add to combine
      }
    });
    $("#group-add").addEventListener("click", () => {
      const id = Number($("#group-picker").value);
      if (Number.isFinite(id)) addGroup(id);
    });

    $("#paste-parse").addEventListener("click", () => parsePasteBox(true));
    $("#paste-fill").addEventListener("click", fillPasteBox);
    $("#paste-box").addEventListener("input", savePasteDraft);
    $("#window-picker").addEventListener("change", loadWindowSource);
    $("#paste-add-window").addEventListener("click", async () => {
      const before = state.pages.length;
      const win = await queryWindowTabs();
      state.pages = dedupe(state.pages.concat(win));
      state.groupPristine = false;
      render();
      const added = state.pages.length - before;
      toast(`Added ${added} tab${added === 1 ? "" : "s"} to the list`);
    });

    $("#select-all").addEventListener("click", () => {
      state.pages.forEach((p) => (p.checked = true));
      render();
    });
    $("#select-none").addEventListener("click", () => {
      state.pages.forEach((p) => (p.checked = false));
      render();
    });

    $("#collection-name").addEventListener("input", (e) => {
      state.name = e.target.value;
      saveNameDraft();
    });

    $("#protect").addEventListener("change", (e) => {
      $("#pw-field").hidden = !e.target.checked;
      if (e.target.checked) $("#link-pass").focus();
    });

    $("#create-link").addEventListener("click", createLink);
    $("#copy-link").addEventListener("click", copyLink);
    $("#shorten-link").addEventListener("click", async () => {
      $("#shorten-link").disabled = true;
      try {
        const short = await shorten(lastLongLink);
        $("#result-link").value = short;
        $("#shorten-link").hidden = true;
        $("#show-original").hidden = false;
        $("#len-warn").hidden = true;
        await copyLink();
      } catch (e) {
        const warn = $("#len-warn");
        warn.textContent = "Couldn't shorten this link — " + (e.message || "the shortener failed") + ". The full link is still below.";
        warn.hidden = false;
        $("#shorten-link").textContent = "Try shortening again";
      } finally {
        $("#shorten-link").disabled = false;
      }
    });
    $("#show-original").addEventListener("click", () => {
      $("#result-link").value = lastLongLink;
      $("#show-original").hidden = true;
      $("#shorten-link").hidden = false;
      $("#shorten-link").textContent = "Shorten link";
      $("#len-warn").hidden = true;
    });
    $("#open-preview").addEventListener("click", () => {
      api.tabs.create({ url: $("#result-link").value });
    });
    $("#result-back").addEventListener("click", () => {
      $("#view-result").hidden = true;
      $("#view-build").hidden = false;
      $("#foot-build").hidden = false;
    });

    Promise.all([loadDrafts(), loadSettings()])
      .then(() => {
        const src = ["window", "group", "paste"].includes(state.source) ? state.source : "window";
        const keepList = state.pages.length > 0; // a restored draft list takes precedence
        if (keepList) state.groupPristine = false;
        return setSource(src, keepList);
      })
      .catch((e) => showError("Could not read this window's tabs: " + e.message));
  }

  document.addEventListener("DOMContentLoaded", init);
})();
