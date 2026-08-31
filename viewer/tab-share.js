/* Tab Share viewer — renders a shared collection from the URL fragment.
   No network requests except optional site icons (icons.duckduckgo.com), which
   the viewer settings can turn off. No storage beyond localStorage prefs and an
   in-session "last page" memory. */
(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const byId = (id) => document.getElementById(id);

  const els = {
    error: byId("state-error"),
    locked: byId("state-locked"),
    slides: byId("state-slides"),
    grid: byId("state-grid"),
    list: byId("state-list"),
    biggrid: byId("state-biggrid"),
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
    viewBtn: byId("btn-view"),
    viewMenu: byId("view-menu"),
    viewLabel: byId("view-label"),
    setBtn: byId("btn-settings"),
    setMenu: byId("settings-menu"),
    setIcons: byId("set-icons"),
    setAuto: byId("set-autopreview"),
    openAll: byId("btn-openall"),
    copyBtn: byId("btn-copy"),
    listBody: byId("list-body"),
    listCopy: byId("list-copy"),
    toast: byId("v-toast"),
    iconNote: byId("v-icon-note"),
  };

  let collection = null;
  let index = 0;
  let mode = "slides"; // slides | grid | list | biggrid
  let segScrollable = false;

  const SEG_MAX = 15;
  const FAVICON = (host) => "https://icons.duckduckgo.com/ip3/" + encodeURIComponent(host) + ".ico";

  /* ---------- utils ---------- */

  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (els.toast.hidden = true), 2200);
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
    const v = lsGet("ts:icons");
    if (v === "on") return true;
    if (v === "off") return false;
    return (collection.flags & 1) !== 0;
  }
  function autoPreviewOn() {
    const v = lsGet("ts:autopreview");
    if (v === "on") return true;
    if (v === "off") return false;
    return (collection.flags & 2) !== 0; // the creator's choice; recipient can override in ⚙
  }

  const sessionKey = () => "tabshare:" + (location.hash || "").slice(1, 40);

  /** Paint a coloured monogram, and lay a favicon over it when icons are on. */
  function paintAvatar(el, url) {
    const m = Monogram.forUrl(url);
    el.textContent = m.label;
    el.style.background = m.bg;
    if (!iconsOn()) return;
    const host = hostOf(url);
    if (!host) return;
    const img = document.createElement("img");
    img.className = "v-fav";
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.src = FAVICON(host);
    img.addEventListener("error", () => img.remove());
    img.addEventListener("load", maybeIconNote);
    el.appendChild(img);
  }

  function maybeIconNote() {
    if (lsGet("ts:iconnote") === "seen") return;
    els.iconNote.hidden = false;
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
      return;
    }

    collection = dec;
    if (!collection || !collection.pages || !collection.pages.length) {
      show(els.error);
      document.title = "Shared tabs — empty link";
      return;
    }
    start();
  }

  function wireUnlock(params) {
    byId("unlock-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      byId("unlock-err").hidden = true;
      const pw = byId("unlock-pw").value;
      const result = await ShareCodec.decrypt(params, pw);
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

    buildGrid();
    buildList();

    let startAt = 0;
    try {
      const saved = parseInt(sessionStorage.getItem(sessionKey()) || "0", 10);
      if (saved > 0 && saved < count) startAt = saved;
    } catch (e) {}
    index = startAt;

    wire();
    const savedView = lsGet("ts:view");
    setMode(["slides", "grid", "list", "biggrid"].indexOf(savedView) >= 0 ? savedView : "slides");
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
    const page = collection.pages[index];
    const host = hostOf(page.url);
    const title = page.title || host || page.url;
    const klass = (window.FrameHosts && FrameHosts.classify(host)) || "unknown";

    els.frameTitle.textContent = `${index + 1}. ${title}`;
    els.slideOpen.href = page.url;
    els.cardOpen.href = page.url;

    paintAvatar(els.mono, page.url);
    els.cardTitle.textContent = title;
    els.cardHost.textContent = host;
    els.cardUrl.textContent = page.url;

    clearEmbed();

    // preview affordance by classification
    els.cardPreview.hidden = klass === "bad";
    els.cardNote.hidden = klass !== "unknown";
    if (klass === "bad") {
      els.footnote.hidden = false;
      els.footnote.textContent =
        "Some sites (Google, X, banks, …) can't be shown inside another page — use “Open this page”.";
    } else {
      els.footnote.hidden = true;
    }
    if (klass === "good" && autoPreviewOn()) livePreview();

    els.counter.textContent = `${index + 1} / ${collection.pages.length}`;
    renderSeg();

    const atStart = index === 0;
    const atEnd = index === collection.pages.length - 1;
    els.navPrev.disabled = atStart;
    els.navNext.disabled = atEnd;

    try {
      sessionStorage.setItem(sessionKey(), String(index));
    } catch (e) {}
  }

  function go(delta) {
    jump(index + delta);
  }
  function jump(to) {
    const next = Math.min(Math.max(to, 0), collection.pages.length - 1);
    index = next;
    if (mode === "slides") renderSlide();
  }

  /* ---------- segmented pager ---------- */

  function renderSeg() {
    const n = collection.pages.length;
    els.seg.innerHTML = "";
    els.seg.classList.toggle("scroll", segScrollable || n <= SEG_MAX);
    const shown = segScrollable || n <= SEG_MAX ? n : SEG_MAX;

    for (let i = 0; i < shown; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seg-i" + (i === index ? " active" : i < index ? " done" : "");
      b.setAttribute("aria-label", `Page ${i + 1}`);
      b.addEventListener("click", () => jump(i));
      els.seg.appendChild(b);
    }
    if (!segScrollable && n > SEG_MAX) {
      const more = document.createElement("button");
      more.type = "button";
      more.className = "seg-more";
      more.textContent = "···";
      more.title = `Show all ${n} pages`;
      more.addEventListener("click", () => {
        segScrollable = true;
        renderSeg();
      });
      els.seg.appendChild(more);
    }
    const active = els.seg.querySelector(".seg-i.active");
    if (active && segScrollable) active.scrollIntoView({ block: "nearest", inline: "center" });
  }

  /* ---------- grid ---------- */

  function buildGrid() {
    els.grid.innerHTML = "";
    const tpl = byId("tpl-grid-card");
    const frag = document.createDocumentFragment();
    collection.pages.forEach((page, i) => {
      const node = tpl.content.firstElementChild.cloneNode(true);
      const host = hostOf(page.url);
      node.href = page.url;
      paintAvatar(node.querySelector(".g-mono"), page.url);
      node.querySelector(".g-title").textContent = page.title || host || page.url;
      node.querySelector(".g-host").textContent = host;
      node.querySelector(".g-index").textContent = String(i + 1).padStart(2, "0");
      node.addEventListener("click", () => (index = i));
      frag.appendChild(node);
    });
    els.grid.appendChild(frag);
  }

  /* ---------- list ---------- */

  function buildList() {
    const width = String(collection.pages.length).length;
    els.listBody.textContent = collection.pages
      .map((p, i) => {
        const num = String(i + 1).padStart(width, " ");
        const t = p.title ? `${num}. ${p.title}\n${" ".repeat(width + 2)}${p.url}` : `${num}. ${p.url}`;
        return t;
      })
      .join("\n");
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

  /* ---------- large grid ---------- */

  let bigObserver = null;
  let bigLive = 0;
  const BIG_LIVE_CAP = 6;

  function buildBigGrid() {
    els.biggrid.innerHTML = "";
    bigLive = 0;
    if (bigObserver) bigObserver.disconnect();
    bigObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const card = en.target;
          bigObserver.unobserve(card);
          mountBigPreview(card);
        });
      },
      { rootMargin: "200px" }
    );

    const tpl = byId("tpl-big-card");
    collection.pages.forEach((page, i) => {
      const node = tpl.content.firstElementChild.cloneNode(true);
      const host = hostOf(page.url);
      node.dataset.i = String(i);
      node.dataset.url = page.url;
      node.dataset.klass = (window.FrameHosts && FrameHosts.classify(host)) || "unknown";
      paintAvatar(node.querySelector(".bg-mono"), page.url);
      node.querySelector(".bg-title").textContent = page.title || host || page.url;
      node.querySelector(".bg-host").textContent = host;
      node.querySelector(".bg-open").href = page.url;
      const viewBtn = node.querySelector(".bg-view");
      viewBtn.textContent = "Open in slideshow";
      viewBtn.addEventListener("click", () => {
        index = i;
        setMode("slides");
      });
      els.biggrid.appendChild(node);
      if (node.dataset.klass === "good") bigObserver.observe(node);
    });
  }

  function mountBigPreview(card) {
    if (bigLive >= BIG_LIVE_CAP) return;
    bigLive++;
    const frame = document.createElement("iframe");
    frame.src = card.dataset.url;
    frame.loading = "lazy";
    frame.referrerPolicy = "no-referrer";
    frame.sandbox = "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox";
    frame.className = "bg-frame";
    card.appendChild(frame);
    card.classList.add("has-frame");
  }

  /* ---------- mode switching ---------- */

  function setMode(next) {
    mode = next;
    lsSet("ts:view", mode);
    els.viewLabel.textContent = { slides: "Slideshow", grid: "Grid", list: "List", biggrid: "Large grid" }[mode];
    closeMenus();

    show({ slides: els.slides, grid: els.grid, list: els.list, biggrid: els.biggrid }[mode]);
    document.querySelectorAll(".v-menu-item").forEach((it) =>
      it.setAttribute("aria-checked", String(it.dataset.mode === mode))
    );

    if (mode === "slides") renderSlide();
    if (mode === "biggrid") buildBigGrid();
  }

  /* ---------- toolbar actions ---------- */

  function openAll() {
    const pages = collection.pages;
    toast(`Opening ${pages.length} tab${pages.length === 1 ? "" : "s"} — allow pop-ups if asked`);
    pages.forEach((p, i) => setTimeout(() => window.open(p.url, "_blank", "noopener"), i * 120));
  }

  function listText() {
    return collection.pages.map((p) => (p.title ? p.title + "\n" : "") + p.url).join("\n\n");
  }

  /* ---------- menus ---------- */

  function closeMenus() {
    els.viewMenu.hidden = true;
    els.setMenu.hidden = true;
    els.viewBtn.setAttribute("aria-expanded", "false");
    els.setBtn.setAttribute("aria-expanded", "false");
  }
  function toggleMenu(menu, btn) {
    const open = menu.hidden;
    closeMenus();
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
  }

  /* ---------- events ---------- */

  function wire() {
    els.navPrev.addEventListener("click", () => go(-1));
    els.navNext.addEventListener("click", () => go(1));
    els.cardPreview.addEventListener("click", livePreview);
    els.openAll.addEventListener("click", openAll);
    els.copyBtn.addEventListener("click", () => copyText(listText(), "List copied"));
    els.listCopy.addEventListener("click", () => copyText(els.listBody.textContent, "List copied"));

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
      if (n >= 1 && n <= collection.pages.length) jump(n - 1);
    };
    els.jumpInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") commitJump();
      if (e.key === "Escape") {
        els.jumpInput.hidden = true;
        els.counter.hidden = false;
      }
    });
    els.jumpInput.addEventListener("blur", commitJump);

    els.viewBtn.addEventListener("click", () => toggleMenu(els.viewMenu, els.viewBtn));
    els.setBtn.addEventListener("click", () => toggleMenu(els.setMenu, els.setBtn));
    els.viewMenu.addEventListener("click", (e) => {
      const it = e.target.closest(".v-menu-item");
      if (it) setMode(it.dataset.mode);
    });
    els.setIcons.addEventListener("change", () => {
      lsSet("ts:icons", els.setIcons.checked ? "on" : "off");
      lsSet("ts:iconnote", "seen");
      els.iconNote.hidden = true;
      rerender();
    });
    els.setAuto.addEventListener("change", () => {
      lsSet("ts:autopreview", els.setAuto.checked ? "on" : "off");
      if (mode === "slides") renderSlide();
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".v-menu-wrap")) closeMenus();
    });

    byId("icon-note-off").addEventListener("click", () => {
      lsSet("ts:icons", "off");
      lsSet("ts:iconnote", "seen");
      els.iconNote.hidden = true;
      els.setIcons.checked = false;
      rerender();
    });
    byId("icon-note-ok").addEventListener("click", () => {
      lsSet("ts:iconnote", "seen");
      els.iconNote.hidden = true;
    });

    document.addEventListener("keydown", (e) => {
      if (e.target.matches("input, textarea")) return;
      if (e.key === "Escape") return closeMenus();
      if (mode !== "slides") return;
      if (e.key === "ArrowRight" || e.key === "PageDown") { go(1); e.preventDefault(); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { go(-1); e.preventDefault(); }
      else if (e.key === "Home") { jump(0); e.preventDefault(); }
      else if (e.key === "End") { jump(collection.pages.length - 1); e.preventDefault(); }
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

    window.addEventListener("hashchange", () => location.reload());
  }

  function rerender() {
    buildGrid();
    buildList();
    if (mode === "slides") renderSlide();
    if (mode === "biggrid") buildBigGrid();
  }

  boot();
})();
