/* Tab Share — background worker.
 *
 * Two jobs, both offline:
 *   1. Handle "import" requests from the viewer-page banner (content script):
 *      open a shared collection into this window / a new window / a tab group,
 *      or save it to history.
 *   2. Register the banner content script for the viewer URL set in options —
 *      any host other than the packaged default (localhost included) after the
 *      user grants that one host in the options page.
 */
"use strict";

const api = globalThis.browser && globalThis.browser.runtime ? globalThis.browser : globalThis.chrome;

// The only host the manifest's static content_scripts entry covers.
const BUILTIN_VIEWER_HOST = "kaikayy.github.io";
const CUSTOM_SCRIPT_ID = "ts-viewer-custom";
const HISTORY_CAP = 50;

/* ---------------- import actions ---------------- */

function urlsOf(collection) {
  return (collection && Array.isArray(collection.pages) ? collection.pages : [])
    .map((p) => p && p.url)
    .filter((u) => typeof u === "string" && /^https?:\/\//i.test(u));
}

async function openInWindow(urls, windowId) {
  for (const url of urls) {
    await api.tabs.create({ url, windowId, active: false });
  }
}

async function openNewWindow(urls) {
  if (!urls.length) return;
  await api.windows.create({ url: urls });
}

async function openInGroup(urls, windowId, title) {
  // tabGroups is a required permission now, but very old builds may still lack
  // the tabs.group() API — fall back to a new window there.
  if (typeof api.tabs.group !== "function" || !(api.tabGroups && api.tabGroups.update)) {
    await openNewWindow(urls);
    return { note: "This browser can't make tab groups — opened a new window instead." };
  }
  const ids = [];
  for (const url of urls) {
    const t = await api.tabs.create({ url, windowId, active: false });
    ids.push(t.id);
  }
  const groupId = await api.tabs.group({ tabIds: ids, createProperties: windowId ? { windowId } : {} });
  try {
    await api.tabGroups.update(groupId, { title: title || "Shared tabs" });
  } catch (e) {}
  return {};
}

async function saveToHistory(link, name, count) {
  const { recents = [] } = await api.storage.local.get("recents");
  const at = Date.now();
  recents.unshift({ id: String(at), link, name: name || "Untitled", count, at });
  await api.storage.local.set({ recents: recents.slice(0, HISTORY_CAP) });
}

async function handleImport(msg, sender) {
  const urls = urlsOf(msg.collection);
  if (!urls.length && msg.mode !== "history") throw new Error("Nothing to open.");
  const windowId = sender && sender.tab ? sender.tab.windowId : undefined;
  const title = (msg.title || (msg.collection && msg.collection.title) || "").trim();

  switch (msg.mode) {
    case "this-window":
      await openInWindow(urls, windowId);
      return { ok: true };
    case "new-window":
      await openNewWindow(urls);
      return { ok: true };
    case "tab-group": {
      const r = await openInGroup(urls, windowId, title);
      return { ok: true, note: r.note };
    }
    case "history":
      await saveToHistory(
        (sender && sender.url) || (msg.collection && msg.collection.link) || "",
        title,
        urls.length
      );
      return { ok: true };
    default:
      throw new Error("Unknown import mode.");
  }
}

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== "ts-import") return;
  // Only our own content script may drive imports, and only from a real tab.
  if (!sender || sender.id !== api.runtime.id || !sender.tab) return;
  handleImport(msg, sender).then(
    (r) => sendResponse(r),
    (e) => sendResponse({ ok: false, error: e && e.message ? e.message : String(e) })
  );
  return true; // async response
});

/* ---------------- dynamic content script for a custom viewer URL ---------------- */

function originPattern(base) {
  try {
    return new URL(base).origin + "/*";
  } catch (e) {
    return null;
  }
}

async function syncCustomContentScript() {
  if (!api.scripting || !api.scripting.registerContentScripts) return;
  let pattern = null;
  try {
    const { viewerBase } = await api.storage.local.get("viewerBase");
    if (viewerBase) pattern = originPattern(viewerBase);
  } catch (e) {}

  // The manifest's static content_scripts entry already covers the packaged
  // default host; every other host (localhost included) goes through the
  // permission-gated dynamic registration below.
  let covered = false;
  try {
    if (pattern) covered = new URL(pattern.replace(/\*$/, "")).hostname === BUILTIN_VIEWER_HOST;
  } catch (e) {}

  let existing = [];
  try {
    existing = await api.scripting.getRegisteredContentScripts({ ids: [CUSTOM_SCRIPT_ID] });
  } catch (e) {}
  const isRegistered = existing.some((s) => s.id === CUSTOM_SCRIPT_ID);

  const wanted = pattern && !covered && (await hasHostPermission(pattern));

  if (!wanted) {
    if (isRegistered) {
      try {
        await api.scripting.unregisterContentScripts({ ids: [CUSTOM_SCRIPT_ID] });
      } catch (e) {}
    }
    return;
  }

  const def = {
    id: CUSTOM_SCRIPT_ID,
    matches: [pattern],
    js: ["src/lib/i18n.js", "src/lib/lzstring.min.js", "src/lib/share-codec.js", "src/content/import-banner.js"],
    runAt: "document_idle",
  };
  try {
    if (isRegistered) await api.scripting.updateContentScripts([def]);
    else await api.scripting.registerContentScripts([def]);
  } catch (e) {
    /* host permission may have been revoked between the check and now */
  }
}

async function hasHostPermission(pattern) {
  try {
    return await api.permissions.contains({ origins: [pattern] });
  } catch (e) {
    return false;
  }
}

if (api.storage && api.storage.onChanged) {
  api.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.viewerBase) syncCustomContentScript();
  });
}
if (api.permissions && api.permissions.onAdded) {
  api.permissions.onAdded.addListener(syncCustomContentScript);
}
if (api.permissions && api.permissions.onRemoved) {
  api.permissions.onRemoved.addListener(syncCustomContentScript);
}
if (api.runtime.onInstalled) {
  api.runtime.onInstalled.addListener((details) => {
    syncCustomContentScript();
    // First install → open the options page so the user can make the setup choices.
    if (details && details.reason === "install") {
      try {
        api.runtime.openOptionsPage();
      } catch (e) {}
    }
  });
}
if (api.runtime.onStartup) api.runtime.onStartup.addListener(syncCustomContentScript);
syncCustomContentScript();
