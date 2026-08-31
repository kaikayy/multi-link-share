/* Tab Share viewer — renders a shared collection from the URL fragment.
   Zero network requests, zero third-party code, no storage beyond an
   in-session "last page" memory. */
(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const byId = (id) => document.getElementById(id);

  const els = {
    error: byId("state-error"),
    slides: byId("state-slides"),
    grid: byId("state-grid"),
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
    counter: byId("counter"),
    progress: byId("progress-fill"),
    navPrev: byId("nav-prev"),
    navNext: byId("nav-next"),
    miniPrev: byId("mini-prev"),
    miniNext: byId("mini-next"),
    viewBtn: byId("btn-view"),
    viewLabel: byId("view-label"),
    openAll: byId("btn-openall"),
    copyBtn: byId("btn-copy"),
    toast: byId("v-toast"),
  };

  let collection = null;
  let index = 0;
  let mode = "slides"; // 'slides' | 'grid'

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

  const sessionKey = () => "tabshare:" + (location.hash || "").slice(1, 40);

  /* ---------- boot ---------- */

  function boot() {
    collection = ShareCodec.decode(location.hash);

    if (!collection || !collection.pages.length) {
      els.error.hidden = false;
      document.title = "Shared tabs — empty link";
      return;
    }

    const count = collection.pages.length;
    els.name.textContent = collection.title || "Shared tabs";
    document.title = (collection.title || "Shared tabs") + ` (${count})`;
    const dateStr = prettyDate(collection.created);
    els.sub.textContent = `${count} page${count === 1 ? "" : "s"}` + (dateStr ? ` · shared ${dateStr}` : "");

    buildGrid();

    let start = 0;
    try {
      const saved = parseInt(sessionStorage.getItem(sessionKey()) || "0", 10);
      if (saved > 0 && saved < count) start = saved;
    } catch (e) {}
    index = start;

    els.slides.hidden = false;
    renderSlide();
    wire();
  }

  /* ---------- slideshow ---------- */

  function clearEmbed() {
    els.embed.hidden = true;
    els.embed.innerHTML = "";
    els.card.hidden = false;
  }

  function renderSlide() {
    const page = collection.pages[index];
    const host = hostOf(page.url);
    const m = Monogram.forUrl(page.url);
    const title = page.title || host || page.url;

    els.frameTitle.textContent = `${index + 1}. ${title}`;
    els.slideOpen.href = page.url;
    els.cardOpen.href = page.url;

    els.mono.textContent = m.label;
    els.mono.style.background = m.bg;
    els.cardTitle.textContent = title;
    els.cardHost.textContent = host;
    els.cardUrl.textContent = page.url;

    clearEmbed();

    els.counter.textContent = `${index + 1} / ${collection.pages.length}`;
    const pct = collection.pages.length > 1 ? (index / (collection.pages.length - 1)) * 100 : 100;
    els.progress.style.width = pct + "%";

    const atStart = index === 0;
    const atEnd = index === collection.pages.length - 1;
    els.navPrev.disabled = els.miniPrev.disabled = atStart;
    els.navNext.disabled = els.miniNext.disabled = atEnd;

    try {
      sessionStorage.setItem(sessionKey(), String(index));
    } catch (e) {}
  }

  function go(delta) {
    const next = Math.min(Math.max(index + delta, 0), collection.pages.length - 1);
    if (next === index) return;
    index = next;
    renderSlide();
  }

  function jump(to) {
    index = Math.min(Math.max(to, 0), collection.pages.length - 1);
    renderSlide();
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
    frame.addEventListener("load", () => {
      settled = true;
    });
    setTimeout(() => {
      if (!settled && !els.embed.hidden) {
        toast("This site is slow or blocking the preview — use “Open”.");
      }
    }, 4000);
  }

  /* ---------- grid ---------- */

  function buildGrid() {
    const tpl = byId("tpl-grid-card");
    const frag = document.createDocumentFragment();
    collection.pages.forEach((page, i) => {
      const node = tpl.content.firstElementChild.cloneNode(true);
      const host = hostOf(page.url);
      const m = Monogram.forUrl(page.url);
      node.href = page.url;
      node.querySelector(".g-mono").textContent = m.label;
      node.querySelector(".g-mono").style.background = m.bg;
      node.querySelector(".g-title").textContent = page.title || host || page.url;
      node.querySelector(".g-host").textContent = host;
      node.querySelector(".g-index").textContent = String(i + 1).padStart(2, "0");
      node.addEventListener("click", (e) => {
        // let normal open-in-new-tab happen, but also sync the slideshow
        index = i;
      });
      frag.appendChild(node);
    });
    els.grid.appendChild(frag);
  }

  function setMode(next) {
    mode = next;
    const gridMode = mode === "grid";
    els.grid.hidden = !gridMode;
    els.slides.hidden = gridMode;
    els.viewLabel.textContent = gridMode ? "Slideshow" : "Grid";
    els.viewBtn.setAttribute("aria-pressed", String(gridMode));
    els.viewBtn.querySelector("use").setAttribute("href", gridMode ? "#v-slides" : "#v-grid");
    if (!gridMode) renderSlide();
  }

  /* ---------- toolbar actions ---------- */

  function openAll() {
    const pages = collection.pages;
    toast(`Opening ${pages.length} tab${pages.length === 1 ? "" : "s"} — allow pop-ups if asked`);
    pages.forEach((p, i) => {
      setTimeout(() => window.open(p.url, "_blank", "noopener"), i * 120);
    });
  }

  async function copyList() {
    const text = collection.pages
      .map((p) => (p.title ? p.title + "\n" : "") + p.url)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      toast("List copied to clipboard");
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        toast("List copied to clipboard");
      } catch (e2) {
        toast("Could not copy automatically");
      }
      ta.remove();
    }
  }

  /* ---------- events ---------- */

  function wire() {
    els.navPrev.addEventListener("click", () => go(-1));
    els.navNext.addEventListener("click", () => go(1));
    els.miniPrev.addEventListener("click", () => go(-1));
    els.miniNext.addEventListener("click", () => go(1));
    els.cardPreview.addEventListener("click", livePreview);
    els.viewBtn.addEventListener("click", () => setMode(mode === "grid" ? "slides" : "grid"));
    els.openAll.addEventListener("click", openAll);
    els.copyBtn.addEventListener("click", copyList);

    document.addEventListener("keydown", (e) => {
      if (e.target.matches("input, textarea")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") { go(1); e.preventDefault(); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { go(-1); e.preventDefault(); }
      else if (e.key === "Home") { jump(0); e.preventDefault(); }
      else if (e.key === "End") { jump(collection.pages.length - 1); e.preventDefault(); }
      else if (e.key.toLowerCase() === "g") setMode(mode === "grid" ? "slides" : "grid");
    });

    // touch swipe
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

  boot();
})();
