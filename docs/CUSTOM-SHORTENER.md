# Bring your own link shortener

Tab Share can run every share link through a shortener of your choice. Options:

- **Tab Share shortener** -- a purpose-built, self-hostable service
  ([tab-share-shortener](https://github.com/kaikayy/tab-share-shortener)). Handles
  the multi-kilobyte links the public shorteners choke on, offers *Normal* (random)
  or *Readable words* short codes, and only shortens links that point at an
  allow-listed viewer host. Picking it in **Options -> Shorten links** pre-fills
  the address with the first-party instance at `https://s.kaikay.de`, which
  allow-lists the built-in viewer (`kaikayy.github.io`) -- so the default setup
  works with no configuration. Point it at your own instance instead if you want
  to run it yourself.
- **da.gd** -- built in, no setup, no account. A small open-source shortener
  (running since 2011) that -- unlike is.gd / TinyURL's older API -- keeps the
  `#…` fragment intact and swallows multi-kilobyte links. `GET https://da.gd/s?url=`.
- **TinyURL** -- built in, no setup, but a public third party sees every link.
- **Custom endpoint** -- any other tiny web service, described below.

All of these are **off by default**; nothing is sent anywhere until you turn one on.

### What each one keeps when a link is opened

| Shortener | Logged on each click | Cookies / 3rd-party trackers | Data sold or shared |
| --- | --- | --- | --- |
| **Tab Share shortener** (`s.kaikay.de` or self-hosted) | aggregate day counts only: hits, referrer *host*, browser family + major version. No IP, no geolocation, no full User-Agent, no per-visitor row. | none | never |
| **da.gd** | a hit counter; small open-source service, no ad or analytics scripts | none observed | no |
| **TinyURL** | IP address, browser type + version, referring URLs, timestamps; forwards your **full referrer** to the destination site | yes | not stated in its policy |
| **Bitly** (not offered here) | per click: timestamp, IP, user-agent, country, city, device, browser, referring domain | yes | yes -- selling click analytics is a paid feature |
| **Custom endpoint** | whatever you build it to log | -- | -- |

TinyURL / Bitly rows are summarised from their published policies and
independent testing as of 2026; they can change them at any time. The full
detail for the first-party one is in the
[Tab Share privacy policy](https://github.com/kaikayy/multi-link-share/blob/main/PRIVACY.md#the-tab-share-shortener-skaikayde)
and the shortener's
[own PRIVACY.md](https://github.com/kaikayy/tab-share-shortener/blob/main/PRIVACY.md).

> **On public shorteners.** `s.kaikay.de`, da.gd and TinyURL are all hosted by
> other people (the first two by the Tab Share author, on a small server). With
> any shortener that is not your own, performance, uptime, and how long a
> shortened link keeps resolving cannot be guaranteed -- if the service goes away
> or drops old links, the short URL breaks (the full link you also copied still
> works). For links you need to keep working, run your own **Tab Share
> shortener**.

## The Tab Share shortener

**Options -> Shorten links**:

1. **Shortener** -> *Tab Share shortener*
2. **Shortener address** -> pre-filled with `https://s.kaikay.de`. Leave it, or
   swap in your own instance (must be `https://`; a `DEV_LOCALHOST=1` build also
   accepts `http://localhost:8779` for testing).
3. **Short link style** -> *Normal* or *Readable words*
4. Save, approve the one host-permission prompt, optionally tick *Shorten
   automatically*.

To run your own instead of `s.kaikay.de`, set it up from its own repo
([SELF-HOSTING.md](https://github.com/kaikayy/tab-share-shortener/blob/main/SELF-HOSTING.md))
-- Node on a box you own, or a Cloudflare Worker -- and put its address in step 2.

Under the hood the extension just calls `<address>/new?url=` (or
`<address>/new?mode=words&url=`) -- the same GET contract as a custom endpoint
below, so the rest of this page applies to it too.

### Viewer host and the allowlist

A Tab Share shortener only shortens links whose **viewer host is on that
shortener's allowlist** -- this is what stops it being turned into an open
redirect. Two independent settings meet here:

- **Viewer base URL** (top of the options page) -- always yours to set to any
  `https://` viewer. This alone always works; the link just is not shortened if
  the next point fails.
- **Shortener** -- if you run your **own** shortener it allows your own viewer
  by default, so nothing to do. If you point at **someone else's** shortener,
  your viewer host has to be one *its operator* allows; otherwise the popup
  says the host is not on that shortener's allowlist and keeps the full link.

Operators grow the list with `SHORTENER_HOSTS` / `SHORTENER_HOSTS_FILE` (see
the shortener's SELF-HOSTING.md).

## Custom endpoint

Any other tiny web service you point the extension at. This section shows what it
has to do and gives a few copy-paste implementations.

## What the extension does

When you set a custom endpoint in **Options -> Shorten links**, Tab Share takes
your endpoint string and **appends the percent-encoded long link**, then does a
plain `GET`:

```
<your endpoint><encodeURIComponent(the full https://.../#token link)>
```

So if your endpoint is `https://s.example.com/new?url=` the request is:

```
GET https://s.example.com/new?url=https%3A%2F%2Fkaikayy.github.io%2Fmulti-link-share%2F%23NoZg...
```

Your service must:

1. **Accept that GET** (no auth, or bake a key into the endpoint string).
2. **Return the short URL** -- either as `text/plain` (just the URL) **or** JSON
   with one of these keys: `shorturl`, `short_url`, `shortUrl`, `short`, `url`,
   `link`, or `result.full_short_link` (YOURLS).
3. **Keep the `#...` fragment.** The whole collection lives after the `#`. Your
   redirect (301/302) must send the browser to `https://.../#token`, fragment
   intact. Store the URL verbatim; don't normalise or strip it.
4. **Allow long URLs.** A 10-page collection is ~1-3 KB; 40 pages ~4 KB. Don't
   cap the input at a few hundred characters.
5. Ideally send `Access-Control-Allow-Origin: *` (see [CORS](#cors) below).

The extension rejects the response if it isn't an `https://` URL, or if it comes
back **no shorter than the original** -- so a service that echoes the input, or
returns an error page, shows a clear "couldn't shorten" message instead of a
broken link.

## Why is.gd / v.gd don't work

They refuse any URL containing a `#` fragment (and block many free-hosting
domains like `github.io`). Every Tab Share link is `https://host/path#token`, so
they always fail. That's why they were removed. TinyURL keeps the fragment and
has no length problem in practice.

## Reference implementations

### A. Cloudflare Worker (free, ~20 lines)

```js
// wrangler init, paste into src/index.js, `wrangler deploy`
export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    const long = u.searchParams.get("url");
    if (!long || !/^https:\/\//.test(long)) return new Response("bad url", { status: 400 });

    // key: a short random id; value: the long url (KV binding named LINKS)
    const id = crypto.randomUUID().slice(0, 7);
    await env.LINKS.put(id, long, { expirationTtl: 60 * 60 * 24 * 365 });

    const short = `${u.origin}/${id}`;
    return new Response(short, { headers: { "content-type": "text/plain", "access-control-allow-origin": "*" } });
  },
};
```

Add a second route for the redirect (same Worker, match `/:id`):

```js
if (u.pathname.length > 1) {
  const long = await env.LINKS.get(u.pathname.slice(1));
  return long ? Response.redirect(long, 301) : new Response("not found", { status: 404 });
}
```

Endpoint to paste into options: `https://your-worker.workers.dev/?url=`

### B. Deno Deploy / Node (KV or a Map)

```ts
// Deno Deploy
const kv = await Deno.openKv();
Deno.serve(async (req) => {
  const u = new URL(req.url);
  if (u.pathname === "/new") {
    const long = u.searchParams.get("url") ?? "";
    if (!long.startsWith("https://")) return new Response("bad url", { status: 400 });
    const id = crypto.randomUUID().slice(0, 7);
    await kv.set(["l", id], long);
    return new Response(`${u.origin}/${id}`, {
      headers: { "content-type": "text/plain", "access-control-allow-origin": "*" },
    });
  }
  const id = u.pathname.slice(1);
  const { value } = await kv.get<string>(["l", id]);
  return value ? Response.redirect(value, 301) : new Response("not found", { status: 404 });
});
```

Endpoint: `https://your-app.deno.dev/new?url=`

### C. YOURLS (self-hosted PHP, the classic)

[YOURLS](https://yourls.org) works out of the box. Its API returns JSON with
`result.full_short_link` (or `shorturl`), which the extension already reads.

Endpoint (signature-based, no username/password in the URL):

```
https://your-yourls.example/yourls-api.php?action=shorturl&format=json&signature=YOUR_SECRET_SIGNATURE&url=
```

Make sure `YOURLS_URL_CONVERT` isn't stripping fragments (default is fine).

## Connecting it

**Options -> Shorten links -> Custom endpoint**, paste the endpoint string ending
in `url=` (or `&url=`), Save, and approve the one-time host-access prompt.
Optionally tick **Shorten automatically**.

Test it: create any share link. If auto-shorten is on, the result shows the
short link; if it failed, the popup shows the reason and keeps the full link,
with a **Try shortening again** button.

## CORS

The extension asks for host access to your endpoint's origin when you save it.
In Chrome/Firefox MV3 that grant lets the popup `fetch` your endpoint **without
a CORS preflight**, so a missing `Access-Control-Allow-Origin` header usually
still works. Adding `access-control-allow-origin: *` (as the samples do) makes
it robust and lets you test the endpoint from a browser console.

## Privacy note

Whatever you run, it now sees the **full share link** -- which contains every
page URL in the collection (in the `#` fragment). Run it yourself, or trust the
operator the way you'd trust any shortener. The default (no shortener) sends the
link to no one.

**The first-party `s.kaikay.de` instance** (run by the Tab Share author) stores
the long URL you shortened, and on each redirect keeps a per-link hit count plus
the **referring host** (e.g. `news.ycombinator.com`), aggregated by day -- no
full referrer, no page path, no IP, no cookies, no per-visitor identifier. Kept
~365 days, visible only through a password-gated admin panel, no third-party
analytics. Full details in the
[Tab Share privacy policy](https://github.com/kaikayy/multi-link-share/blob/main/PRIVACY.md#the-tab-share-shortener-skaikayde)
and the shortener's
[own privacy note](https://github.com/kaikayy/tab-share-shortener/blob/main/PRIVACY.md).
Self-host it (`SHORTENER_ANALYTICS=0`, `SHORTENER_COUNT_HITS=0`) to keep none of
this.
