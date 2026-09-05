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
    settings: { showIcons: true, autoPreview: true, shortProvider: "", shortEndpoint: "", shortBase: "", shortAuto: false, shortMode: "code" },
  };

  async function loadSettings() {
    try {
      const s = await api.storage.local.get([
        "showIcons",
        "autoPreview",
        "shortProvider",
        "shortEndpoint",
        "shortBase",
        "shortMode",
        "shortAuto",
      ]);
      // is.gd / v.gd reject '#'-fragment and github.io URLs, so they never worked
      // for share links -- retired in favour of TinyURL / a custom endpoint.
      const provider = s.shortProvider === "isgd" || s.shortProvider === "vgd" ? "" : s.shortProvider || "";
      let endpoint = s.shortEndpoint || "";
      const mode = s.shortMode === "words" ? "words" : "code";

      // A "Tab Share shortener" left pointing at localhost (an old DEV_LOCALHOST
      // build) can't be granted in a shipped build -- move it to the packaged
      // default. Skipped where localhost IS a grantable host (a DEV build).
      const dflt = ((CFG && CFG.DEFAULT_SHORTENER_BASE) || "").replace(/\/+$/, "");
      const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i;
      let localhostGrantable = false;
      try {
        localhostGrantable = (api.runtime.getManifest().optional_host_permissions || []).some((p) =>
          /^https?:\/\/(localhost|127\.0\.0\.1)\//.test(p),
        );
      } catch (e) {}
      if (provider === "tabshare" && /^https:\/\//i.test(dflt) && !localhostGrantable &&
          (local.test((s.shortBase || "").trim()) || local.test(endpoint))) {
        endpoint = dflt + "/new?" + (mode === "words" ? "mode=words&" : "") + "url=";
        try {
          await api.storage.local.set({ shortBase: dflt, shortEndpoint: endpoint });
        } catch (e) {}
      }

      state.settings = {
        showIcons: s.showIcons === true, // default OFF
        autoPreview: s.autoPreview !== false,
        shortProvider: provider,
        shortEndpoint: endpoint,
        shortBase: s.shortBase || "",
        shortAuto: !!s.shortAuto,
        shortMode: mode,
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
    opt("current", I18N.t("p_groupThisWindow"));
    opt("all", I18N.t("p_groupAllWindows", { n: wins.length }));
    let n = 0;
    wins.forEach((w) => {
      n += 1;
      if (w.id === cur.id) return;
      const webCount = (w.tabs || []).filter((t) => isWebUrl(t.url)).length;
      opt(String(w.id), I18N.t(webCount === 1 ? "p_groupWindowN" : "p_groupWindowNPlural", { n, count: webCount }));
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
      unsupported.textContent = I18N.t("p_groupNoApi");
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
      $("#group-unsupported").textContent = I18N.t("p_groupNone");
      return;
    }
    picker.innerHTML = "";
    groups.forEach((g) => {
      const opt = document.createElement("option");
      opt.value = String(g.id);
      opt.textContent = (g.title && g.title.trim()) || I18N.t("p_groupFallback", { color: g.color || "untitled" });
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
    toast(added > 0 ? I18N.t(added === 1 ? "p_toastAddedTabOne" : "p_toastAddedTabOther", { n: added }) : I18N.t("p_toastGroupAlready"));
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
    if (!found.length) toast(I18N.t("p_toastNoValidLinks"));
    else toast(added > 0 ? I18N.t(added === 1 ? "p_toastAddedLinkOne" : "p_toastAddedLinkOther", { n: added }) : I18N.t("p_toastLinksAlready"));
  }

  async function fillPasteBox() {
    const tabs = await queryWindowTabs();
    if (!tabs.length) {
      toast(I18N.t("p_toastNoTabsOpen"));
      return;
    }
    const box = $("#paste-box");
    const existing = box.value.trim();
    const urls = tabs.map((t) => t.url).join("\n");
    box.value = existing ? existing + "\n" + urls : urls;
    savePasteDraft();
    box.focus();
    toast(I18N.t(tabs.length === 1 ? "p_toastLoadedUrlOne" : "p_toastLoadedUrlOther", { n: tabs.length }));
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
      I18N.applyStatic(node);

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
    $("#count-label").textContent = I18N.t(n === 1 ? "p_pagesSelectedOne" : "p_pagesSelectedOther", { n });
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
      showError(I18N.t("p_errEnterPassword"));
      return;
    }

    let token;
    try {
      token = ShareCodec.encode({ title: name, pages, flags }, { minimal: $("#minimal").checked });
      if (password) token = await ShareCodec.encrypt(token, password);
    } catch (e) {
      showError(e.message || I18N.t("p_errBuildFailed"));
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
        shortenNote = I18N.t("p_toastCouldntShorten", { reason: e.message || I18N.t("p_errShortenerFailed") });
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

  /** Origin of the configured Tab Share shortener -- the stored base, or parsed
   *  back out of the `<base>/new?...url=` endpoint string for older installs. */
  function shortenerBase() {
    const b = String(state.settings.shortBase || "").replace(/\/+$/, "");
    if (/^https?:\/\//i.test(b)) return b;
    try {
      return new URL(state.settings.shortEndpoint).origin;
    } catch (e) {
      return "";
    }
  }

  /** A provider added, or an address migrated, without the matching host grant:
   *  request it now (this runs from a user gesture -- Shorten-link / build). */
  async function ensureShortenerHost(url) {
    try {
      const pattern = new URL(url).origin + "/*";
      if (api.permissions && !(await api.permissions.contains({ origins: [pattern] }))) {
        if (!(await api.permissions.request({ origins: [pattern] }))) {
          const err = new Error(I18N.t("p_errShortenerHostAccess"));
          err.tsHostDenied = true;
          throw err;
        }
      }
    } catch (e) {
      if (e && e.tsHostDenied) throw e;
      /* permissions API unavailable -- let the fetch below try anyway */
    }
  }

  function finishShort(text, longUrl) {
    const short = pickShortUrl(text);
    if (!short) throw new Error(I18N.t("p_errShortenerNoLink"));
    if (short.length >= longUrl.length) throw new Error(I18N.t("p_errShortenerNotShorter"));
    return short;
  }

  async function shorten(longUrl) {
    const p = state.settings.shortProvider;

    // Tab Share shortener: POST the long link in a JSON body to /api/shorten.
    // The GET /new compat path puts the whole link in the query string, so the
    // request line runs to 10 KB+ -- a reverse proxy in front of the server
    // (nginx's default large_client_header_buffers) rejects that with HTTP 414.
    if (p === "tabshare") {
      const base = shortenerBase();
      if (!base) throw new Error(I18N.t("p_errShortenerNotSetUp"));
      const endpoint = base + "/api/shorten";
      await ensureShortenerHost(endpoint);
      let res;
      try {
        res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json, text/plain" },
          body: JSON.stringify({ url: longUrl, mode: state.settings.shortMode === "words" ? "words" : "code" }),
        });
      } catch (e) {
        throw new Error(I18N.t("p_errShortenerUnreachable"));
      }
      const text = await res.text();
      if (!res.ok) {
        let detail = "";
        try {
          detail = JSON.parse(text).error || "";
        } catch (e) {}
        if (res.status === 414 || res.status === 413) {
          throw new Error(detail || I18N.t("p_errShortenerTooLarge"));
        }
        // e.g. a link whose viewer host the shortener does not allowlist.
        throw new Error(detail || I18N.t("p_errShortenerHttp", { status: res.status }));
      }
      return finishShort(text, longUrl);
    }

    const enc = encodeURIComponent(longUrl);
    let url;
    if (p === "tinyurl") url = `https://tinyurl.com/api-create.php?url=${enc}`;
    else if (p === "dagd") url = `https://da.gd/s?url=${enc}`;
    else if (p === "custom" && state.settings.shortEndpoint) url = state.settings.shortEndpoint + enc;
    else throw new Error(I18N.t("p_errShortenerNotSetUp"));

    await ensureShortenerHost(url);

    let res;
    try {
      res = await fetch(url, { headers: { Accept: "text/plain, application/json" } });
    } catch (e) {
      throw new Error(I18N.t("p_errShortenerUnreachable"));
    }
    const text = await res.text();
    if (!res.ok) {
      let detail = "";
      try {
        detail = JSON.parse(text).error || "";
      } catch (e) {}
      // GET shorteners carry the link in the URL, so a big collection can trip
      // the provider's request-line limit -- the built-in shortener takes these.
      if (res.status === 414 || res.status === 413) {
        const label = p === "tinyurl" ? "TinyURL" : p === "dagd" ? "da.gd" : I18N.t("p_labelThatShortener");
        throw new Error(I18N.t("p_errShortenerTooLargeOther", { label }));
      }
      throw new Error(detail || I18N.t("p_errShortenerHttp", { status: res.status }));
    }

    return finishShort(text, longUrl);
  }

  async function autoCopy(link) {
    try {
      await navigator.clipboard.writeText(link);
      toast(I18N.t("p_toastLinkCopiedClipboard"));
    } catch (e) {
      toast(I18N.t("p_toastLinkCopiedManual"));
    }
  }

  function showResult(link, name, count, encrypted, shortenNote) {
    $("#view-build").hidden = true;
    $("#foot-build").hidden = true;
    $("#view-result").hidden = false;

    $("#result-name").textContent = name || I18N.t("p_untitledCollection");
    $("#result-sub").textContent = I18N.t(count === 1 ? "p_resultSubOne" : "p_resultSubOther", { n: count });
    $("#result-link").value = link;
    $("#pw-note").hidden = !encrypted;

    const longLink = link.length > (CFG.SOFT_URL_LIMIT || 12000);
    // A shortener is configured and we're still on the long link — offer the
    // button (whether auto-shorten is off, or it's on but just failed).
    const showShorten = !!state.settings.shortProvider && link === lastLongLink;
    // No shortener, but the link is long — nudge toward setting one up.
    const showEnable = !state.settings.shortProvider && longLink && link === lastLongLink;
    $("#shorten-row").hidden = !(showShorten || showEnable);
    $("#shorten-link").hidden = !showShorten;
    $("#shorten-link").textContent = I18N.t(shortenNote ? "p_shortenAgain" : "p_shortenLink");
    $("#enable-shortener").hidden = !showEnable;
    $("#show-original").hidden = true;

    const warn = $("#len-warn");
    if (shortenNote) {
      warn.hidden = false;
      warn.textContent = shortenNote;
    } else if (longLink) {
      warn.hidden = false;
      warn.textContent =
        I18N.t("p_lenWarn", { chars: link.length.toLocaleString(I18N.locale()) }) +
        I18N.t(showEnable ? "p_lenWarnShortener" : "p_lenWarnFewer");
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
      toast(I18N.t("p_toastLinkCopied"));
    } catch (e) {
      const inp = $("#result-link");
      inp.focus();
      inp.select();
      try {
        document.execCommand("copy");
        toast(I18N.t("p_toastLinkCopied"));
      } catch (e2) {
        toast(I18N.t("p_toastPressToCopy"));
      }
    }
  }

  /* ---------- recents ---------- */

  const HISTORY_CAP = 50;

  async function saveRecent(link, name, count) {
    try {
      const { recents = [] } = await api.storage.local.get("recents");
      const at = Date.now();
      recents.unshift({ id: String(at), link, name: name || I18N.t("p_untitled"), count, at });
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

  /* ---------- "use a shortener" tip ---------- */

  // Shown at the top of the build view until the user sets up a shortener or
  // x-es it away (the dismissal sticks).
  async function refreshShortenerNotice() {
    const el = $("#shortener-notice");
    if (!el) return;
    if (state.settings.shortProvider) {
      el.hidden = true; // already using one — nothing to recommend
      return;
    }
    let dismissed = false;
    try {
      const s = await api.storage.local.get("shortenerNoticeDismissed");
      dismissed = !!s.shortenerNoticeDismissed;
    } catch (e) {}
    el.hidden = dismissed;
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
    // Language lives in Settings now (I18N.getLang() reads the same localStorage
    // key from there) -- just render the popup in whichever language is current.
    I18N.applyStatic();

    $("#open-options").addEventListener("click", () => api.runtime.openOptionsPage());
    $("#enable-shortener").addEventListener("click", () => api.runtime.openOptionsPage());

    $("#notice-setup").addEventListener("click", () => api.runtime.openOptionsPage());
    $("#notice-dismiss").addEventListener("click", () => {
      $("#shortener-notice").hidden = true;
      try {
        api.storage.local.set({ shortenerNoticeDismissed: true });
      } catch (e) {}
    });

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
        warn.textContent = I18N.t("p_toastCouldntShortenStill", { reason: e.message || I18N.t("p_errShortenerFailed") });
        warn.hidden = false;
        $("#shorten-link").textContent = I18N.t("p_shortenAgain");
      } finally {
        $("#shorten-link").disabled = false;
      }
    });
    $("#show-original").addEventListener("click", () => {
      $("#result-link").value = lastLongLink;
      $("#show-original").hidden = true;
      $("#shorten-link").hidden = false;
      $("#shorten-link").textContent = I18N.t("p_shortenLink");
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
        refreshShortenerNotice();
        const src = ["window", "group", "paste"].includes(state.source) ? state.source : "window";
        const keepList = state.pages.length > 0; // a restored draft list takes precedence
        if (keepList) state.groupPristine = false;
        return setSource(src, keepList);
      })
      .catch((e) => showError(I18N.t("p_errReadTabs", { msg: e.message })));
  }

  document.addEventListener("DOMContentLoaded", init);
})();
