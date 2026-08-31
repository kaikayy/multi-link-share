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
    },
    windows: { getCurrent: () => asyncOk({ id: 1 }) },
    tabGroups: {
      query: () => asyncOk([{ id: 7, title: "Hummingbirds", color: "pink", windowId: 1 }]),
      get: (id) => asyncOk({ id, title: "Hummingbirds", color: "pink" }),
    },
    permissions: {
      _granted: new Set(),
      contains: ({ permissions }) => asyncOk(permissions.every((p) => window.chrome.permissions._granted.has(p))),
      request: ({ permissions }) => {
        permissions.forEach((p) => window.chrome.permissions._granted.add(p));
        return asyncOk(true);
      },
    },
    storage: {
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
