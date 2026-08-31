/*!
 * frame-hosts.js — a small, static, offline classifier for whether a site is
 * worth trying to show inside an <iframe>.
 *
 *   'good'    — known to allow framing; the viewer previews it automatically.
 *   'bad'     — known to block framing (X-Frame-Options / CSP frame-ancestors)
 *               AND a preview attempt is pointless; the viewer offers only
 *               "Open this page".
 *   'unknown' — everything else: show the card + a "Try live preview" button.
 *
 * Matching is by hostname suffix (so `en.wikipedia.org` matches `wikipedia.org`).
 * This list is curated and intentionally conservative — it never blocks a page,
 * it only changes which preview affordance is shown.
 */
(function (root) {
  "use strict";

  var GOOD = [
    "wikipedia.org",
    "wikimedia.org",
    "wikibooks.org",
    "wiktionary.org",
    "wikisource.org",
    "wikivoyage.org",
    "developer.mozilla.org",
    "arxiv.org",
    "example.com",
    "example.org",
    "example.net",
    "openstreetmap.org",
    "gutenberg.org",
    "rfc-editor.org",
    "w3.org",
    "whatwg.org",
    "ietf.org",
    "python.org",
    "docs.python.org",
    "readthedocs.io",
    "mdn.dev",
    "caniuse.com",
    "css-tricks.com",
    "smashingmagazine.com",
    "web.dev",
    "html.spec.whatwg.org",
  ];

  var BAD = [
    "google.com",
    "google.co.uk",
    "google.de",
    "youtube.com",
    "x.com",
    "twitter.com",
    "facebook.com",
    "instagram.com",
    "linkedin.com",
    "reddit.com",
    "tiktok.com",
    "amazon.com",
    "amazon.de",
    "amazon.co.uk",
    "netflix.com",
    "paypal.com",
    "stripe.com",
    "chase.com",
    "bankofamerica.com",
    "wellsfargo.com",
    "citi.com",
    "hsbc.com",
    "barclays.co.uk",
    "revolut.com",
    "coinbase.com",
    "binance.com",
    "github.com",
    "gitlab.com",
    "notion.so",
    "figma.com",
    "slack.com",
    "discord.com",
    "microsoft.com",
    "live.com",
    "office.com",
    "apple.com",
    "icloud.com",
  ];

  function endsWithHost(host, suffix) {
    return host === suffix || host.slice(-(suffix.length + 1)) === "." + suffix;
  }

  function classify(host) {
    if (typeof host !== "string" || !host) return "unknown";
    host = host.toLowerCase().replace(/^www\./, "");
    for (var i = 0; i < BAD.length; i++) if (endsWithHost(host, BAD[i])) return "bad";
    for (var j = 0; j < GOOD.length; j++) if (endsWithHost(host, GOOD[j])) return "good";
    return "unknown";
  }

  root.FrameHosts = { classify: classify };
})(typeof self !== "undefined" ? self : this);
