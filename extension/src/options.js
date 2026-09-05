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
      throw new Error(I18N.t("o_errInvalidUrl"));
    }
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      throw new Error(I18N.t("o_errNeedsHttps"));
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

  /* ---------------- preferences ---------------- */

  const PREF_KEYS = ["showIcons", "autoPreview", "import.disabled", "import.noauto", "import.default"];

  async function loadPrefs() {
    const s = await api.storage.local.get(PREF_KEYS);
    $("#pref-icons").checked = s.showIcons === true; // default OFF (privacy)
    $("#pref-autopreview").checked = s.autoPreview !== false; // default on
    $("#pref-banner").checked = !s["import.disabled"]; // default on
    $("#pref-autoopen").checked = !s["import.noauto"]; // default on
    $("#pref-default").value = s["import.default"] || "";
  }

  async function savePrefs() {
    await api.storage.local.set({
      showIcons: $("#pref-icons").checked,
      autoPreview: $("#pref-autopreview").checked,
      "import.disabled": !$("#pref-banner").checked,
      "import.noauto": !$("#pref-autoopen").checked,
      "import.default": $("#pref-default").value || "",
    });
    flash("#pref-msg");
  }

  function flash(sel) {
    const el = $(sel);
    el.hidden = false;
    clearTimeout(flash._t);
    flash._t = setTimeout(() => (el.hidden = true), 1600);
  }

  /* ---------------- shortener ---------------- */

  const PROVIDER_ORIGIN = {
    tinyurl: "https://tinyurl.com/*",
    dagd: "https://da.gd/*",
  };

  const DEFAULT_SHORT_BASE = (CFG && CFG.DEFAULT_SHORTENER_BASE) || "";

  /** Turn a Tab Share shortener base + style into the endpoint string the popup
   *  appends the encoded long URL to. */
  function tabshareEndpoint(base, mode) {
    const b = String(base || "").replace(/\/+$/, "");
    return b + "/new?" + (mode === "words" ? "mode=words&" : "") + "url=";
  }

  function toggleShortFields() {
    const p = $("#short-provider").value;
    $("#short-tabshare-wrap").hidden = p !== "tabshare";
    $("#short-endpoint-wrap").hidden = p !== "custom";
  }

  /** A Chrome host match pattern for `parsed` -- scheme + host, NO port
   *  (ports are not allowed in match patterns; `origin` would include one and
   *  `permissions.request` then rejects it). */
  function hostPattern(parsed) {
    return parsed.protocol + "//" + parsed.hostname + "/*";
  }

  const LOCAL_ADDR = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i;

  /** True in a DEV_LOCALHOST build (localhost is a grantable host there). */
  function localhostAllowed() {
    try {
      return (api.runtime.getManifest().optional_host_permissions || []).some((p) =>
        /^https?:\/\/(localhost|127\.0\.0\.1)\//.test(p),
      );
    } catch (e) {
      return false;
    }
  }

  async function loadShortener() {
    const s = await api.storage.local.get([
      "shortProvider",
      "shortEndpoint",
      "shortAuto",
      "shortBase",
      "shortMode",
    ]);
    // is.gd / v.gd never worked for share links (they reject '#'-fragment URLs) --
    // drop a stored value silently.
    let prov = s.shortProvider || "";
    if (prov === "isgd" || prov === "vgd") {
      prov = "";
      try {
        await api.storage.local.set({ shortProvider: "", shortAuto: false });
      } catch (e) {}
    }

    // A stored "Tab Share shortener" address left on localhost (from an old
    // DEV_LOCALHOST build) can't be granted in a shipped build -- move it to the
    // packaged default and persist, so the popup uses the live endpoint too.
    let base = s.shortBase || "";
    if (LOCAL_ADDR.test(base) && !localhostAllowed() && /^https:\/\//i.test(DEFAULT_SHORT_BASE)) {
      base = DEFAULT_SHORT_BASE.replace(/\/+$/, "");
      const patch = { shortBase: base };
      if (prov === "tabshare") {
        patch.shortEndpoint = tabshareEndpoint(base, s.shortMode === "words" ? "words" : "code");
      }
      try {
        await api.storage.local.set(patch);
      } catch (e) {}
      if (patch.shortEndpoint) s.shortEndpoint = patch.shortEndpoint;
    }

    $("#short-provider").value = prov;
    $("#short-endpoint").value = s.shortEndpoint || "";
    // Pre-fill the address field from the stored value, else the baked default.
    $("#short-base").value = base || DEFAULT_SHORT_BASE || "";
    $("#short-mode").value = s.shortMode === "words" ? "words" : "code";
    $("#short-auto").checked = !!s.shortAuto;
    toggleShortFields();
  }

  async function saveShortener() {
    $("#short-msg").hidden = true;
    $("#short-err").hidden = true;
    const provider = $("#short-provider").value;
    let endpoint = ($("#short-endpoint").value || "").trim();
    const base = ($("#short-base").value || "").trim();
    const mode = $("#short-mode").value === "words" ? "words" : "code";

    let pattern = PROVIDER_ORIGIN[provider] || null;

    // Provider picked but not configured yet (e.g. just chosen from the dropdown):
    // persist the choice quietly and wait for an address -- no error, no prompt.
    if ((provider === "tabshare" && !base) || (provider === "custom" && !endpoint)) {
      await api.storage.local.set({
        shortProvider: provider,
        shortEndpoint: endpoint,
        shortAuto: $("#short-auto").checked,
        shortBase: base,
        shortMode: mode,
      });
      return;
    }

    if (provider === "tabshare") {
      let parsed;
      try {
        parsed = new URL(base);
      } catch (e) {
        $("#short-err").textContent = I18N.t("o_errShortenerAddress");
        $("#short-err").hidden = false;
        return;
      }
      const localhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
      if (parsed.protocol !== "https:" && !localhost) {
        $("#short-err").textContent = I18N.t("o_errShortenerHttps");
        $("#short-err").hidden = false;
        return;
      }
      endpoint = tabshareEndpoint(base, mode);
      pattern = hostPattern(parsed);
    } else if (provider === "custom") {
      let parsed;
      try {
        parsed = new URL(endpoint);
      } catch (e) {
        $("#short-err").textContent = I18N.t("o_errValidEndpoint");
        $("#short-err").hidden = false;
        return;
      }
      const localhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
      if (parsed.protocol !== "https:" && !localhost) {
        $("#short-err").textContent = I18N.t("o_errEndpointHttps");
        $("#short-err").hidden = false;
        return;
      }
      pattern = hostPattern(parsed);
    }

    if (pattern) {
      try {
        const has = await api.permissions.contains({ origins: [pattern] });
        if (!has) {
          const granted = await api.permissions.request({ origins: [pattern] });
          if (!granted) {
            $("#short-err").textContent = I18N.t("o_errNotSavedHostAccess");
            $("#short-err").hidden = false;
            return;
          }
        }
      } catch (e) {
        $("#short-err").textContent = I18N.t("o_errCouldntRequestHost", { detail: e.message || e });
        $("#short-err").hidden = false;
        return;
      }
    }

    await api.storage.local.set({
      shortProvider: provider,
      shortEndpoint: endpoint,
      shortAuto: $("#short-auto").checked,
      shortBase: base,
      shortMode: mode,
    });
    flash("#short-msg");
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
            $("#save-err").textContent = I18N.t("o_savedNoHostAccess");
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
    if (s < 60) return I18N.t("o_relJustNow");
    if (s < 3600) return I18N.t("o_relMinAgo", { n: Math.floor(s / 60) });
    if (s < 86400) return I18N.t("o_relHourAgo", { n: Math.floor(s / 3600) });
    const d = Math.floor(s / 86400);
    if (d < 30) return I18N.t("o_relDayAgo", { n: d });
    try {
      return new Date(ts).toLocaleDateString(I18N.locale());
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
      node.querySelector(".h-name").textContent = r.name || I18N.t("p_untitled");
      node.querySelector(".h-sub").textContent = I18N.t(r.count === 1 ? "o_histSubOne" : "o_histSubOther", {
        count: r.count || 0,
        rel: relDate(r.at),
      });
      I18N.applyStatic(node);

      node.querySelector(".h-acts").addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-act]");
        if (!btn) return;
        const act = btn.dataset.act;
        if (act === "copy") {
          try {
            await navigator.clipboard.writeText(r.link);
            toast(I18N.t("o_toastLinkCopied"));
          } catch (err) {
            toast(I18N.t("o_toastCouldNotCopy"));
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

  /** The welcome header is highlighted on the first visit only; after that it
   *  stays at the top but drops the accent. */
  async function markWelcomeSeen() {
    try {
      const { optionsSeen } = await api.storage.local.get("optionsSeen");
      if (optionsSeen) {
        $("#welcome").classList.add("seen");
      } else {
        await api.storage.local.set({ optionsSeen: true });
      }
    } catch (e) {
      /* storage unavailable -- leave the highlight on */
    }
  }

  /* ---------------- language ---------------- */

  function wireLanguage() {
    $("#pref-language").value = I18N.getLang();
    $("#pref-language").addEventListener("change", (e) => {
      I18N.setLang(e.target.value);
      I18N.applyStatic();
      renderHistory(); // re-translate cloned history rows + relative dates
      flash("#pref-msg");
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    I18N.applyStatic();
    wireLanguage();
    markWelcomeSeen();
    loadPrefs();
    loadShortener();
    loadViewer();
    renderHistory();

    // Keep the page in sync when settings change elsewhere (e.g. the viewer's
    // "hide the button" toggle writes import.disabled).
    if (api.storage && api.storage.onChanged) {
      api.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        const k = Object.keys(changes);
        if (k.some((x) => x.startsWith("import.") || x === "showIcons" || x === "autoPreview")) loadPrefs();
        if (k.some((x) => x.startsWith("short"))) loadShortener();
        if (k.includes("recents")) renderHistory();
      });
    }

    ["#pref-icons", "#pref-autopreview", "#pref-banner", "#pref-autoopen", "#pref-default"].forEach((sel) =>
      $(sel).addEventListener("change", savePrefs)
    );

    $("#short-provider").addEventListener("change", () => {
      toggleShortFields();
      saveShortener();
    });
    $("#short-endpoint").addEventListener("change", saveShortener);
    $("#short-base").addEventListener("change", saveShortener);
    $("#short-mode").addEventListener("change", saveShortener);
    $("#short-auto").addEventListener("change", saveShortener);

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
