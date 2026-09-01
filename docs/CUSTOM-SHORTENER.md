# Bring your own link shortener

Tab Share can run every share link through a shortener of your choice. TinyURL is
built in; anything else is a **custom endpoint** -- a tiny web service you point
the extension at. This page shows what it has to do and gives a few
copy-paste implementations.

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
