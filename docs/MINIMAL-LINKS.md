# Minimal links

A **minimal link** is a share link with the extras stripped out: it carries the
page URLs and the collection name, and nothing else. Same tabs, roughly half the
characters.

It is a checkbox in the popup, next to *Protect with a password*. Off by default.

## What is in a normal link vs a minimal link

The whole collection travels inside the link, after the `#`. Schema v4 splits
that payload into a required **core** and an optional **ext** blob:

```
normal   [4, name, flags, [url, url, ...], { c: created, t: [titles] }]
minimal  [4, name, flags, [url, url, ...]]
```

| | normal link | minimal link |
|---|---|---|
| Page URLs | yes | yes |
| Collection name | yes | yes |
| View flags (site icons, auto-preview) | yes | yes |
| Page titles | yes | **dropped** |
| "Shared on `<date>`" | yes | **dropped** |

## What you lose

**Page titles.** The viewer has always fallen back to the site name when a page
has no title, so a minimal link still opens and still navigates. The slideshow,
the grid and the list all work. They just lead with hosts (`allaboutbirds.org`)
instead of headlines (`Anna's Hummingbird - Cornell Lab`).

**The creation date.** The viewer normally shows a small "shared on 3 Sep 2026"
line under the collection name. A minimal link has no timestamp, so that line is
absent.

That is the whole list. Nothing about *which* pages open, or in what order,
changes.

## What you do not lose

- Every URL, exactly as it was (see the one exception below).
- The collection name.
- Password protection - a minimal link can still be encrypted.
- Every view: slideshow, preview grid, compact grid, copyable list, filter,
  selection mode.
- The recipient still needs no extension.

## Tracking parameters are removed (from every link, not just minimal)

Schema v4 strips known ad and analytics query parameters from every page URL
when the link is built: `utm_source`, `utm_medium`, `utm_campaign`, `fbclid`,
`gclid`, `mc_cid`, `igshid`, and about thirty more. These never change which
page loads - they exist to attribute a click to a campaign - and dropping them
shortens the link and stops the recipient seeing where you found the page.

Left untouched: the host, any real query parameter (`?id=42`, `?q=hummingbird`,
`?v=abc` on YouTube), and a page's own `#fragment` (`...#installation`). Generic
parameter names a site might use for real state - `si`, `ext`, `ref` - are
**not** on the list. `www.` is not stripped either; some hosts genuinely behave
differently with and without it.

## Do old links still work?

Yes. Every link anyone has already shared keeps working. The viewer's decoder
reads v1, v2, v3 **and** v4 - v4 is a new branch, not a replacement.

The one direction that matters: a **v4 link needs a viewer that has the v4
decoder**. Opened in an older, cached copy of the viewer, a v4 link shows
"couldn't read this link" until the page is refreshed against the current
viewer. If you self-host the viewer, update it before you start sending v4
links.

## Minimal links and the shortener

They are complementary, not either-or.

- The **Tab Share shortener** (`s.kaikay.de` or your own) is still the
  recommendation for anything you will paste into a chat, a slide, or a
  document. It gives you `s.kaikay.de/swift-amber-otter` instead of several
  hundred characters, and the link stays editable and revocable.
- A **minimal link** makes the raw link itself smaller. If you are not using a
  shortener, or you want the shortener's stored row and request to be smaller,
  turn it on.
- The two stack. The "your link is getting long, set up the shortener" nudge in
  the popup fires on the *final* length, so a minimal link that is still long
  still gets nudged.

## When to use it

Turn on **Minimal link** when the link length matters more than the page titles:
pasting into a length-limited field, a QR code, somewhere the titles would just
be noise. Leave it off when you want the recipient to see a readable list of
what you sent - which is most of the time.
