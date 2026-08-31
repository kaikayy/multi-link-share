/* Tab Share viewer — renders a shared collection from the URL fragment.
   No network requests except optional site icons (icons.duckduckgo.com), which
   are OFF by default and toggled in the ⚙ menu. No storage beyond localStorage
   prefs and an in-session "last page" memory. */
(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const byId = (id) => document.getElementById(id);

  const els = {
    error: byId("state-error"),
    locked: byId("state-locked"),
    slides: byId("state-slides"),
    grid: byId("state-grid"),
    gridBody: byId("state-grid-body"),
    gridPager: byId("grid-pager"),
    list: byId("state-list"),
    listBody: byId("list-body"),
    listEmpty: byId("list-empty"),
    biggrid: byId("state-biggrid"),
    bigBody: byId("state-biggrid-body"),
    bigPager: byId("big-pager"),
    name: byId("coll-name"),
    sub: byId("coll-sub"),
    frameTitle: byId("slide-title"),
    slideOpen: byId("slide-open"),
    card: byId("slide-card"),
    embed: byId("slide-embed"),
    mono: byId("slide-mono"),
    cardTitle: byId("card-title"),
    cardHost: byId("card-host"),
    cardUrl: byId("card-url"),
    cardOpen: byId("card-open"),
    cardPreview: byId("card-preview"),
    cardNote: byId("card-note"),
    counter: byId("counter"),
    jumpInput: byId("jump-input"),
    seg: byId("seg-bar"),
    footnote: byId("frame-footnote"),
    navPrev: byId("nav-prev"),
    navNext: byId("nav-next"),
    navFirst: byId("nav-first"),
    navLast: byId("nav-last"),
    navPrevB: byId("nav-prev-b"),
    navNextB: byId("nav-next-b"),
    viewBtn: byId("btn-view"),
    viewMenu: byId("view-menu"),
    setBtn: byId("btn-settings"),
    setMenu: byId("settings-menu"),
    setIcons: byId("set-icons"),
    setAuto: byId("set-autopreview"),
    themeBtn: byId("btn-theme"),
    searchBtn: byId("btn-search"),
    searchBar: byId("search-bar"),
    searchInput: byId("search-input"),
    searchClear: byId("search-clear"),
    openPage: byId("btn-openall"),
    selBtn: byId("btn-select"),
    selBar: byId("sel-bar"),
    selCount: byId("sel-count"),
    selAll: byId("sel-all"),
    selOpen: byId("sel-open"),
    selMenu: byId("sel-menu"),
    selDone: byId("sel-done"),
    listCopy: byId("list-copy"),
    listCopyLinks: byId("list-copy-links"),
    toast: byId("v-toast"),
  };

  let collection = null;
  let index = 0;
  let mode = "slides"; // slides | grid | list | biggrid("Preview Grid")
  let query = "";
  let selectMode = false;
  const selected = new Set(); // real page indices
  let gridPage = 0;
  let bigPage = 0;
  let slideRendered = false;

  const GRID_PAGE = 27;
  const BIG_PAGE = 9;
  const MODES = ["slides", "biggrid", "grid", "list"];
  const FAVICON = (host) => "https://icons.duckduckgo.com/ip3/" + encodeURIComponent(host) + ".ico";

  /* ---------- utils ---------- */

  function toast(msg, ms) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (els.toast.hidden = true), ms || 2200);
  }

  function hostOf(url) {
    try {
      return new URL(url).host.replace(/^www\./, "");
    } catch (e) {
      return "";
    }
  }

  function prettyDate(ts) {
    if (!ts) return "";
    try {
      return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch (e) {
      return "";
    }
  }

  const lsGet = (k) => {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  };
  const lsSet = (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch (e) {}
  };

  function iconsOn() {
    return lsGet("ts:icons") === "on"; // OFF by default (privacy)
  }
  function autoPreviewOn() {
    const v = lsGet("ts:autopreview");
    if (v === "on") return true;
    if (v === "off") return false;
    return (collection.flags & 2) !== 0;
  }

  const sessionKey = () => "tabshare:" + (location.hash || "").slice(1, 40);

  /** Paint a coloured monogram, and lay a favicon tile over it when icons are on. */
  function paintAvatar(el, url) {
    const m = Monogram.forUrl(url);
    el.textContent = m.label;
    el.style.background = m.bg;
    el.querySelectorAll("img.v-fav").forEach((n) => n.remove());
    if (!iconsOn()) return;
    const host = hostOf(url);
    if (!host) return;
    const img = document.createElement("img");
    img.className = "v-fav";
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.src = FAVICON(host);
    img.addEventListener("error", () => img.remove());
    el.appendChild(img);
  }

  /* ---------- search / filtering ---------- */

  function matches(i) {
    if (!query) return true;
    const p = collection.pages[i];
    return (
      (p.title || "").toLowerCase().includes(query) ||
      p.url.toLowerCase().includes(query) ||
      hostOf(p.url).toLowerCase().includes(query)
    );
  }

  /** Real page indices currently visible (respecting the search filter). */
  function visible() {
    const out = [];
    for (let i = 0; i < collection.pages.length; i++) if (matches(i)) out.push(i);
    return out;
  }

  function setQuery(q) {
    query = (q || "").trim().toLowerCase();
    gridPage = 0;
    bigPage = 0;
    const vis = visible();
    if (vis.length && vis.indexOf(index) === -1) index = vis[0];
    rerender();
  }

  /* ---------- boot ---------- */

  function show(state) {
    [els.error, els.locked, els.slides, els.grid, els.list, els.biggrid].forEach((s) => (s.hidden = true));
    state.hidden = false;
  }

  function boot() {
    const dec = ShareCodec.decode(location.hash);

    if (dec && dec.encrypted) {
      document.title = "Locked — Tab Share";
      show(els.locked);
      wireUnlock(dec._params);
      wireChrome();
      return;
    }

    collection = dec;
    if (!collection || !collection.pages || !collection.pages.length) {
      show(els.error);
      document.title = "Shared tabs — empty link";
      wireChrome();
      return;
    }
    start();
  }

  function wireUnlock(params) {
    byId("unlock-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      byId("unlock-err").hidden = true;
      const result = await ShareCodec.decrypt(params, byId("unlock-pw").value);
      if (!result) {
        byId("unlock-err").hidden = false;
        byId("unlock-pw").select();
        return;
      }
      collection = result;
      start();
    });
  }

  function start() {
    const count = collection.pages.length;
    els.name.textContent = collection.title || "Shared tabs";
    document.title = (collection.title || "Shared tabs") + ` (${count})`;
    const dateStr = prettyDate(collection.created);
    els.sub.textContent = `${count} page${count === 1 ? "" : "s"}` + (dateStr ? ` · shared ${dateStr}` : "");

    els.setIcons.checked = iconsOn();
    els.setAuto.checked = autoPreviewOn();

    let startAt = 0;
    try {
      const saved = parseInt(sessionStorage.getItem(sessionKey()) || "0", 10);
      if (saved > 0 && saved < count) startAt = saved;
    } catch (e) {}
    index = startAt;

    wireChrome();
    wireSlides();
    setMode("slides"); // always open in the slideshow
  }

  /* ---------- slideshow ---------- */

  function clearEmbed() {
    els.embed.hidden = true;
    els.embed.innerHTML = "";
    els.card.hidden = false;
  }

  function livePreview() {
    const page = collection.pages[index];
    const frame = document.createElement("iframe");
    frame.src = page.url;
    frame.referrerPolicy = "no-referrer";
    frame.loading = "eager";
    frame.sandbox = "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox";
    els.embed.innerHTML = "";
    els.embed.appendChild(frame);
    els.embed.hidden = false;
    els.card.hidden = true;

    let settled = false;
    frame.addEventListener("load", () => (settled = true));
    setTimeout(() => {
      if (!settled && !els.embed.hidden) toast("This site is slow or blocking the preview — use “Open”.");
    }, 4000);
  }

  function renderSlide() {
    const vis = visible();
    if (!vis.length) {
      els.card.hidden = false;
      clearEmbed();
      els.frameTitle.textContent = "No matches";
      els.cardTitle.textContent = "Nothing matches your search";
      els.cardHost.textContent = els.cardUrl.textContent = "";
      els.cardPreview.hidden = true;
      els.cardNote.hidden = true;
      els.counter.textContent = "0 / 0";
      els.seg.innerHTML = "";
      return;
    }
    if (vis.indexOf(index) === -1) index = vis[0];

    const page = collection.pages[index];
    const host = hostOf(page.url);
    const title = page.title || host || page.url;
    const klass = (window.FrameHosts && FrameHosts.classify(host)) || "unknown";
    const pos = vis.indexOf(index);

    els.frameTitle.textContent = `${String(index + 1).padStart(2, "0")}.  ${title}`;
    els.slideOpen.href = page.url;
    els.cardOpen.href = page.url;

    paintAvatar(els.mono, page.url);
    els.cardTitle.textContent = title;
    els.cardHost.textContent = host;
    els.cardUrl.textContent = page.url;

    clearEmbed();

    const badMsg = "This site (Google, X, banks, …) blocks being shown inside another page — use “Open this page”.";
    els.cardPreview.hidden = klass === "bad";
    els.footnote.hidden = true; // the note lives on the card only, never doubled below
    if (klass === "bad") {
      els.cardNote.hidden = false;
      els.cardNote.textContent = badMsg;
    } else {
      els.cardNote.hidden = klass !== "unknown";
      els.cardNote.textContent = "Live preview is best-effort — many sites refuse to display inside another page.";
    }
    if (klass === "good" && autoPreviewOn()) livePreview();

    els.counter.textContent = `${pos + 1} / ${vis.length}`;
    renderSeg(vis, pos);

    els.navPrev.disabled = els.navPrevB.disabled = els.navFirst.disabled = pos === 0;
    els.navNext.disabled = els.navNextB.disabled = els.navLast.disabled = pos === vis.length - 1;

    slideRendered = true;
    try {
      sessionStorage.setItem(sessionKey(), String(index));
    } catch (e) {}
  }

  function setIndex(i) {
    if (i === index && slideRendered && mode === "slides") return; // no reload
    index = i;
    if (mode === "slides") renderSlide();
  }
  function go(delta) {
    const vis = visible();
    const pos = Math.min(Math.max(vis.indexOf(index) + delta, 0), vis.length - 1);
    if (vis[pos] != null) setIndex(vis[pos]);
  }
  function jumpPos(pos) {
    const vis = visible();
    const p = Math.min(Math.max(pos, 0), vis.length - 1);
    if (vis[p] != null) setIndex(vis[p]);
  }
  function jumpRealIndex(i) {
    const vis = visible();
    if (vis.indexOf(i) !== -1) setIndex(i);
  }

  /* ---------- segmented pager (current only) ---------- */

  function renderSeg(vis, pos) {
    const n = vis.length;
    els.seg.innerHTML = "";
    // All pages get a segment; they shrink to fit. Past ~40 the gap closes up
    // so the bar stays one tidy strip rather than wrapping or scrolling.
    els.seg.classList.toggle("dense", n > 40);
    els.seg.classList.toggle("packed", n > 80);
    for (let i = 0; i < n; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seg-i" + (i === pos ? " active" : "");
      b.setAttribute("aria-label", `Page ${i + 1}`);
      b.addEventListener("click", () => jumpPos(i));
      els.seg.appendChild(b);
    }
  }

  /* ---------- generic pager ([⏮ ◀ n/total ▶ ⏭]) ---------- */

  function iconBtn(symbol, cls, onClick, dis) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = cls;
    b.disabled = !!dis;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "vi");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "#" + symbol);
    svg.appendChild(use);
    b.appendChild(svg);
    b.addEventListener("click", onClick);
    return b;
  }

  function renderPager(el, page, pageCount, onGo) {
    el.hidden = pageCount <= 1;
    if (pageCount <= 1) return;
    el.innerHTML = "";
    el.append(
      iconBtn("v-first", "v-mini", () => onGo(0), page === 0),
      iconBtn("v-prev", "v-mini", () => onGo(page - 1), page === 0)
    );
    const c = document.createElement("span");
    c.className = "v-count";
    c.textContent = `${page + 1} / ${pageCount}`;
    el.append(
      c,
      iconBtn("v-next", "v-mini", () => onGo(page + 1), page === pageCount - 1),
      iconBtn("v-last", "v-mini", () => onGo(pageCount - 1), page === pageCount - 1)
    );
  }

  /* ---------- grid ---------- */

  function buildGrid() {
    els.gridBody.innerHTML = "";
    const vis = visible();
    const pageCount = Math.max(1, Math.ceil(vis.length / GRID_PAGE));
    if (gridPage >= pageCount) gridPage = pageCount - 1;
    const paged = vis.length > GRID_PAGE;
    const slice = paged ? vis.slice(gridPage * GRID_PAGE, gridPage * GRID_PAGE + GRID_PAGE) : vis;

    const tpl = byId("tpl-grid-card");
    const frag = document.createDocumentFragment();
    slice.forEach((i) => {
      const page = collection.pages[i];
      const node = tpl.content.firstElementChild.cloneNode(true);
      const host = hostOf(page.url);
      node.href = page.url;
      node.title = page.url; // full link on hover
      paintAvatar(node.querySelector(".g-mono"), page.url);
      node.querySelector(".g-title").textContent = page.title || host || page.url;
      node.querySelector(".g-host").textContent = host;
      node.querySelector(".g-index").textContent = String(i + 1).padStart(2, "0");
      wireCard(node, node.querySelector(".g-check"), i);
      frag.appendChild(node);
    });
    els.gridBody.appendChild(frag);
    renderPager(els.gridPager, gridPage, paged ? pageCount : 1, (p) => {
      gridPage = p;
      buildGrid();
    });
  }

  /* ---------- list ---------- */

  function buildList() {
    els.listBody.innerHTML = "";
    const vis = visible();
    els.listEmpty.hidden = vis.length > 0;
    els.listBody.classList.toggle("selectable", selectMode);
    vis.forEach((i) => {
      const p = collection.pages[i];
      const li = document.createElement("li");

      let cb = null;
      if (selectMode) {
        cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "li-check";
        cb.setAttribute("aria-label", "Select");
        li.appendChild(cb);
      }

      const num = document.createElement("span");
      num.className = "li-index";
      num.textContent = String(i + 1).padStart(2, "0");

      const meta = document.createElement("span");
      meta.className = "li-meta";
      const t = document.createElement("span");
      t.className = "li-t";
      t.textContent = p.title || hostOf(p.url) || p.url;
      const u = document.createElement("a");
      u.className = "li-u";
      u.href = p.url;
      u.target = "_blank";
      u.rel = "noopener noreferrer";
      u.textContent = p.url;
      meta.append(t, u);

      li.append(num, meta);
      if (selectMode) wireCard(li, cb, i);
      els.listBody.appendChild(li);
    });
  }

  async function copyText(text, okMsg) {
    try {
      await navigator.clipboard.writeText(text);
      toast(okMsg);
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        toast(okMsg);
      } catch (e2) {
        toast("Could not copy automatically");
      }
      ta.remove();
    }
  }

  function copyAll() {
    return visible()
      .map((i) => {
        const p = collection.pages[i];
        return (p.title ? p.title + "\n" : "") + p.url;
      })
      .join("\n\n");
  }
  function copyLinksOnly() {
    return visible()
      .map((i) => collection.pages[i].url)
      .join("\n");
  }

  /* ---------- preview grid (all large tiles) ---------- */

  let bigObserver = null;
  let bigLive = 0;
  const BIG_LIVE_CAP = 6;

  function buildBigGrid() {
    els.bigBody.innerHTML = "";
    bigLive = 0;
    if (bigObserver) bigObserver.disconnect();
    bigObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          bigObserver.unobserve(en.target);
          mountBigPreview(en.target);
        });
      },
      { rootMargin: "300px" }
    );

    const vis = visible();
    const pageCount = Math.max(1, Math.ceil(vis.length / BIG_PAGE));
    if (bigPage >= pageCount) bigPage = pageCount - 1;
    const paged = vis.length > BIG_PAGE;
    const slice = paged ? vis.slice(bigPage * BIG_PAGE, bigPage * BIG_PAGE + BIG_PAGE) : vis;

    const tpl = byId("tpl-big-card");
    slice.forEach((i) => {
      const page = collection.pages[i];
      const node = tpl.content.firstElementChild.cloneNode(true);
      const host = hostOf(page.url);
      const klass = (window.FrameHosts && FrameHosts.classify(host)) || "unknown";
      node.dataset.i = String(i);
      node.dataset.url = page.url;
      node.dataset.klass = klass;
      node.title = page.url;
      paintAvatar(node.querySelector(".bg-mono"), page.url);
      const bgTitle = node.querySelector(".bg-title");
      bgTitle.textContent = page.title || host || page.url;
      bgTitle.href = page.url;
      node.querySelector(".bg-host").textContent = host;
      node.querySelector(".bg-index").textContent = String(i + 1).padStart(2, "0");
      node.querySelector(".bg-open").href = page.url;
      node.querySelector(".bg-view").addEventListener("click", () => {
        index = i;
        setMode("slides");
      });
      wireCard(node, node.querySelector(".bg-check"), i);

      const shot = node.querySelector(".bg-shot");
      if (klass === "good") {
        bigObserver.observe(node);
      } else {
        node.classList.add("no-preview");
        const av = document.createElement("span");
        av.className = "bg-bigmono";
        paintAvatar(av, page.url);
        const note = document.createElement("p");
        note.textContent = "This site can't be previewed here — open it in a tab.";
        shot.append(av, note);
      }
      els.bigBody.appendChild(node);
    });
    renderPager(els.bigPager, bigPage, paged ? pageCount : 1, (p) => {
      bigPage = p;
      buildBigGrid();
    });
  }

  function mountBigPreview(card) {
    if (bigLive >= BIG_LIVE_CAP) {
      card.classList.add("no-preview");
      return;
    }
    bigLive++;
    const frame = document.createElement("iframe");
    frame.src = card.dataset.url;
    frame.loading = "lazy";
    frame.referrerPolicy = "no-referrer";
    frame.sandbox = "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox";
    frame.className = "bg-frame";
    card.querySelector(".bg-shot").appendChild(frame);
    card.classList.add("has-frame");
  }

  /* ---------- mode switching ---------- */

  function setMode(next) {
    if (selectMode && next === "slides") next = "grid"; // slideshow has no checkboxes
    mode = next;
    lsSet("ts:view", mode);
    closeMenus();
    show({ slides: els.slides, grid: els.grid, list: els.list, biggrid: els.biggrid }[mode]);
    document.querySelectorAll(".v-tile").forEach((it) =>
      it.setAttribute("aria-checked", String(it.dataset.mode === mode))
    );
    if (mode === "slides") renderSlide();
    if (mode === "grid") buildGrid();
    if (mode === "list") buildList();
    if (mode === "biggrid") buildBigGrid();
  }

  function rerender() {
    if (mode === "slides") renderSlide();
    if (mode === "grid") buildGrid();
    if (mode === "list") buildList();
    if (mode === "biggrid") buildBigGrid();
  }

  /* ---------- selection mode ---------- */

  /** Wire a grid/preview card: navigate normally, or toggle its checkbox in select mode. */
  function wireCard(node, checkbox, i) {
    if (checkbox) {
      checkbox.hidden = !selectMode;
      checkbox.checked = selected.has(i);
      checkbox.addEventListener("click", (e) => {
        e.stopPropagation();
        if (checkbox.checked) selected.add(i);
        else selected.delete(i);
        updateSelBar();
      });
    }
    node.addEventListener("click", (e) => {
      if (selectMode) {
        e.preventDefault();
        if (checkbox) {
          checkbox.checked = !checkbox.checked;
          checkbox.checked ? selected.add(i) : selected.delete(i);
          updateSelBar();
        }
        return;
      }
      index = i;
    });
  }

  function updateSelBar() {
    const total = visible().length;
    els.selCount.textContent = `${selected.size} / ${total} selected`;
    els.selOpen.disabled = selected.size === 0;
    els.selAll.textContent = selected.size >= total && total > 0 ? "Select none" : "Select all";
  }

  function enterSelect() {
    selectMode = true;
    selected.clear();
    els.selBtn.setAttribute("aria-pressed", "true");
    els.selBar.hidden = false;
    if (mode === "slides") setMode("grid"); // slideshow can't show checkboxes
    else rerender();
    updateSelBar();
  }
  function exitSelect() {
    selectMode = false;
    selected.clear();
    els.selBtn.setAttribute("aria-pressed", "false");
    els.selBar.hidden = true;
    els.selMenu.hidden = true;
    rerender();
  }

  function openSelected(openMode) {
    els.selMenu.hidden = true;
    const urls = [...selected].sort((a, b) => a - b).map((i) => collection.pages[i].url);
    if (!urls.length) return;
    if (openMode === "this-window" || !window.__tabShare) {
      if (openMode !== "this-window") toast("Install Tab Share to open these as a group");
      toast(`Opening ${urls.length} tab${urls.length === 1 ? "" : "s"} — allow pop-ups if asked`);
      urls.forEach((u, n) => setTimeout(() => window.open(u, "_blank", "noopener"), n * 120));
    } else {
      window.dispatchEvent(new CustomEvent("tabshare:open", { detail: { mode: openMode, urls } }));
      toast(openMode === "new-window" ? "Opening a new window…" : "Opening a tab group…");
    }
    exitSelect();
  }

  /* ---------- toolbar actions ---------- */

  function openAllPages() {
    const vis = visible();
    if (!vis.length) return;
    toast(`Opening ${vis.length} tab${vis.length === 1 ? "" : "s"} — allow pop-ups if asked`);
    vis.forEach((i, n) => setTimeout(() => window.open(collection.pages[i].url, "_blank", "noopener"), n * 120));
  }

  function applyTheme(t) {
    const light = t === "light";
    if (light) document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");
    lsSet("ts:theme", light ? "light" : "dark");
    els.themeBtn.querySelector("use").setAttribute("href", light ? "#v-sun" : "#v-moon");
  }

  /* ---------- menus ---------- */

  function closeMenus() {
    els.viewMenu.hidden = true;
    els.setMenu.hidden = true;
    els.selMenu.hidden = true;
    els.viewBtn.setAttribute("aria-expanded", "false");
    els.setBtn.setAttribute("aria-expanded", "false");
    els.selOpen.setAttribute("aria-expanded", "false");
  }
  function toggleMenu(menu, btn) {
    const open = menu.hidden;
    closeMenus();
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
  }

  /* ---------- events ---------- */

  function wireChrome() {
    // theme
    applyTheme(lsGet("ts:theme") === "light" ? "light" : "dark");
    els.themeBtn.addEventListener("click", () => {
      applyTheme(document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light");
    });

    // search
    const openSearch = () => {
      els.searchBar.hidden = false;
      els.searchBtn.setAttribute("aria-pressed", "true");
      els.searchInput.focus();
    };
    const closeSearch = () => {
      els.searchBar.hidden = true;
      els.searchBtn.setAttribute("aria-pressed", "false");
      els.searchInput.value = "";
      setQuery("");
    };
    els.searchBtn.addEventListener("click", () => (els.searchBar.hidden ? openSearch() : closeSearch()));
    els.searchInput.addEventListener("input", () => setQuery(els.searchInput.value));
    els.searchClear.addEventListener("click", closeSearch);

    // selection mode
    els.selBtn.addEventListener("click", () => (selectMode ? exitSelect() : enterSelect()));
    els.selDone.addEventListener("click", exitSelect);
    els.selAll.addEventListener("click", () => {
      const vis = visible();
      if (selected.size >= vis.length) selected.clear();
      else vis.forEach((i) => selected.add(i));
      rerender();
      updateSelBar();
    });
    els.selOpen.addEventListener("click", () => toggleMenu(els.selMenu, els.selOpen));
    els.selMenu.addEventListener("click", (e) => {
      const it = e.target.closest("[data-open]");
      if (it) openSelected(it.dataset.open);
    });

    // menus
    els.viewBtn.addEventListener("click", () => toggleMenu(els.viewMenu, els.viewBtn));
    els.setBtn.addEventListener("click", () => toggleMenu(els.setMenu, els.setBtn));
    els.viewMenu.addEventListener("click", (e) => {
      const it = e.target.closest(".v-tile");
      if (it) setMode(it.dataset.mode);
    });
    els.setIcons.addEventListener("change", () => {
      lsSet("ts:icons", els.setIcons.checked ? "on" : "off");
      if (els.setIcons.checked && lsGet("ts:iconnote") !== "seen") {
        lsSet("ts:iconnote", "seen");
        toast("Site icons are loaded from duckduckgo.com — turn this off any time in the ⚙ menu.", 6500);
      }
      rerender();
    });
    els.setAuto.addEventListener("change", () => {
      lsSet("ts:autopreview", els.setAuto.checked ? "on" : "off");
      if (mode === "slides") renderSlide();
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".v-menu-wrap")) closeMenus();
    });

    els.openPage.addEventListener("click", openAllPages);
    els.listCopy.addEventListener("click", () => copyText(copyAll(), "Copied"));
    els.listCopyLinks.addEventListener("click", () => copyText(copyLinksOnly(), "Links copied"));

    window.addEventListener("hashchange", () => location.reload());
  }

  function wireSlides() {
    [els.navPrev, els.navPrevB].forEach((b) => b.addEventListener("click", () => go(-1)));
    [els.navNext, els.navNextB].forEach((b) => b.addEventListener("click", () => go(1)));
    els.navFirst.addEventListener("click", () => jumpPos(0));
    els.navLast.addEventListener("click", () => jumpPos(Infinity));
    els.cardPreview.addEventListener("click", livePreview);

    els.counter.addEventListener("click", () => {
      els.jumpInput.value = String(index + 1);
      els.jumpInput.max = String(collection.pages.length);
      els.counter.hidden = true;
      els.jumpInput.hidden = false;
      els.jumpInput.focus();
      els.jumpInput.select();
    });
    const commitJump = () => {
      const n = parseInt(els.jumpInput.value, 10);
      els.jumpInput.hidden = true;
      els.counter.hidden = false;
      if (n >= 1 && n <= collection.pages.length && n - 1 !== index) jumpRealIndex(n - 1);
    };
    els.jumpInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") commitJump();
      if (e.key === "Escape") {
        els.jumpInput.hidden = true;
        els.counter.hidden = false;
      }
    });
    els.jumpInput.addEventListener("blur", commitJump);

    document.addEventListener("keydown", (e) => {
      if (e.target.matches("input, textarea")) return;
      if (e.key === "Escape") return closeMenus();
      if (mode !== "slides") return;
      if (e.key === "ArrowRight" || e.key === "PageDown") { go(1); e.preventDefault(); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { go(-1); e.preventDefault(); }
      else if (e.key === "Home") { jumpPos(0); e.preventDefault(); }
      else if (e.key === "End") { jumpPos(Infinity); e.preventDefault(); }
    });

    let x0 = null;
    const frame = $(".v-frame");
    frame.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
    frame.addEventListener("touchend", (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
      x0 = null;
    }, { passive: true });
  }

  boot();
})();
