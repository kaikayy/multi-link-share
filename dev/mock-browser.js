/* Fake `chrome.*` surface so popup.html / options.html can be opened directly
   in a normal tab for visual work. NOT shipped (scripts/build.mjs excludes dev/). */
(function () {
  const FAKE_TABS = [
    { id: 1, url: "https://en.wikipedia.org/wiki/Anna's_hummingbird", title: "Anna's hummingbird — Wikipedia", groupId: 7, active: true },
    { id: 2, url: "https://www.allaboutbirds.org/guide/Annas_Hummingbird", title: "Anna's Hummingbird Identification", groupId: 7 },
    { id: 3, url: "https://www.youtube.com/watch?v=abc123", title: "Hummingbird in slow motion (4K)", groupId: 7 },
    { id: 4, url: "https://scholar.google.com/scholar?q=hummingbird+flight", title: "hummingbird flight - Google Scholar", groupId: -1 },
    { id: 5, url: "chrome://newtab/", title: "New Tab", groupId: -1 },
    { id: 6, url: "https://www.nature.org/en-us/about-us/where-we-work/", title: "Where We Work | The Nature Conservancy", groupId: -1 },
  ];
  const store = { viewerBase: "", recents: [] };

  const asyncOk = (v) => Promise.resolve(v);

  window.chrome = {
    runtime: {
      openOptionsPage: () => console.log("(mock) would open the options page"),
      sendMessage: (msg) => {
        console.log("(mock) runtime.sendMessage", msg);
        return asyncOk({ ok: true });
      },
      onMessage: { addListener() {}, removeListener() {} },
      onInstalled: { addListener() {} },
      onStartup: { addListener() {} },
      lastError: null,
    },
    tabs: {
      query: (q = {}) =>
        asyncOk(
          FAKE_TABS.filter((t) => {
            if (q.active && !t.active) return false;
            if (q.groupId != null && t.groupId !== q.groupId) return false;
            return true;
          })
        ),
      create: ({ url }) => {
        console.log("(mock) tabs.create", url);
        return asyncOk({ id: 99, url });
      },
      group: ({ tabIds }) => {
        console.log("(mock) tabs.group", tabIds);
        return asyncOk(42);
      },
    },
    windows: {
      getCurrent: () => asyncOk({ id: 1 }),
      create: ({ url }) => {
        console.log("(mock) windows.create", url);
        return asyncOk({ id: 2 });
      },
    },
    tabGroups: {
      query: () => asyncOk([{ id: 7, title: "Hummingbirds", color: "pink", windowId: 1 }]),
      get: (id) => asyncOk({ id, title: "Hummingbirds", color: "pink" }),
      update: (id, props) => {
        console.log("(mock) tabGroups.update", id, props);
        return asyncOk({ id, ...props });
      },
    },
    permissions: {
      _granted: new Set(),
      contains: ({ permissions = [], origins = [] }) =>
        asyncOk(
          permissions.every((p) => window.chrome.permissions._granted.has(p)) &&
            origins.every((o) => window.chrome.permissions._granted.has(o))
        ),
      request: ({ permissions = [], origins = [] }) => {
        [...permissions, ...origins].forEach((p) => window.chrome.permissions._granted.add(p));
        return asyncOk(true);
      },
      onAdded: { addListener() {} },
      onRemoved: { addListener() {} },
    },
    scripting: {
      getRegisteredContentScripts: () => asyncOk([]),
      registerContentScripts: () => asyncOk(),
      updateContentScripts: () => asyncOk(),
      unregisterContentScripts: () => asyncOk(),
    },
    storage: {
      onChanged: { addListener() {} },
      local: {
        get: (key) => {
          if (key == null) return asyncOk({ ...store });
          if (typeof key === "string") return asyncOk({ [key]: store[key] });
          const out = {};
          for (const k of Object.keys(key)) out[k] = store[k] ?? key[k];
          return asyncOk(out);
        },
        set: (obj) => {
          Object.assign(store, obj);
          return asyncOk();
        },
        remove: (k) => {
          delete store[k];
          return asyncOk();
        },
      },
    },
  };
})();
