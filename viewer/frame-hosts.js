/*!
 * frame-hosts.js — a static, offline classifier for whether a page is worth
 * trying to show inside an <iframe>.
 *
 *   'good'    — sends no anti-framing headers and renders cleanly; the viewer
 *               previews it automatically (when auto-preview is on).
 *   'bad'     — blocks framing (X-Frame-Options / CSP frame-ancestors) or is a
 *               login / consent / SPA wall where a preview is pointless; the
 *               viewer shows only "Open this page".
 *   'unknown' — everything else: the card plus a "Try live preview" button.
 *
 * The GOOD / BAD lists were built by probing the response headers of the ~700
 * most-visited / most-shared domains (see tools/frame-probe) in 2026-08, then
 * hand-reviewing the ambiguous cases. Matching is by registrable-domain suffix,
 * so "en.wikipedia.org" matches "wikipedia.org". The list never blocks a
 * page — it only picks which preview affordance is shown — and callers may add
 * runtime observations via FrameHosts.remember().
 */
(function (root) {
  "use strict";

  // Allows framing — safe to auto-preview.
  var GOOD = [
    "404media.co", "500px.com", "abcnews.go.com", "angular.dev", "archive.org", "babeljs.io",
    "bandcamp.com", "blogger.com", "blogspot.com", "caniuse.com", "clojure.org",
    "commons.wikimedia.org", "core.ac.uk", "cran.r-project.org", "cyberchef.io", "d3js.org",
    "danluu.com", "desmos.com", "devdocs.io", "doaj.org", "doc.rust-lang.org",
    "docs.oracle.com", "docs.python.org", "en.wikipedia.org", "esa.int", "eslint.org",
    "etymonline.com", "example.com", "example.net", "example.org", "excalidraw.com",
    "explainxkcd.com", "fsf.org", "geogebra.org", "getbootstrap.com", "github.io",
    "gitlab.com", "gitlab.io", "godbolt.org", "gutenberg.net.au", "gutenberg.org",
    "hemingwayapp.com", "html.spec.whatwg.org", "iep.utm.edu", "imgflip.com",
    "indiehackers.com", "jsfiddle.net", "jsonformatter.org", "jsonlint.com", "julialang.org",
    "jvns.ca", "lobste.rs", "logseq.com", "lua.org", "marginalia.nu", "mathway.com",
    "mediawiki.org", "mermaid.live", "metoffice.gov.uk", "nginx.org", "nodejs.org", "npr.org",
    "nps.gov", "ocw.mit.edu", "openlibrary.org", "ourworldindata.org", "oyez.org", "p5js.org",
    "paulgraham.com", "pbs.org", "photopea.com", "platformer.news", "plato.stanford.edu",
    "plos.org", "poetryfoundation.org", "postcss.org", "prettier.io", "processing.org",
    "projectgutenberg.org", "r-project.org", "react.dev", "readthedocs.io", "readthedocs.org",
    "regexr.com", "rentry.co", "rfc-editor.org", "ruby-lang.org", "rust-lang.org",
    "sass-lang.com", "scala-lang.org", "signal.org", "sqlite.org", "squoosh.app",
    "supremecourt.gov", "svelte.dev", "tailwindcss.com", "threejs.org", "tio.run",
    "tldraw.com", "typescriptlang.org", "vitejs.dev", "weather.gov", "web.archive.org",
    "whatwg.org", "wikibooks.org", "wikidata.org", "wikimedia.org", "wikinews.org",
    "wikipedia.org", "wikiquote.org", "wikisource.org", "wikispecies.org", "wikivoyage.org",
    "wiktionary.org", "xkcd.com",
  ];

  // Blocks framing, or a preview would only show a login / cookie / app shell.
  var BAD = [
    "9to5google.com", "9to5mac.com", "a16z.com", "aa.com", "academia.edu", "accor.com",
    "accuweather.com", "adobe.com", "agoda.com", "airbnb.com", "airfrance.com", "airfrance.fr",
    "airtable.com", "akamai.com", "alibaba.com", "aliexpress.com", "aljazeera.com",
    "allmusic.com", "amazon.ca", "amazon.co.jp", "amazon.co.uk", "amazon.com", "amazon.com.br",
    "amazon.de", "amazon.es", "amazon.fr", "amazon.in", "amazon.it", "amazon.nl", "amazon.se",
    "americanexpress.com", "androidauthority.com", "androidpolice.com", "angel.co",
    "anthropic.com", "apache.org", "apnews.com", "apple.com", "archive.ph", "archive.today",
    "archlinux.org", "arstechnica.com", "arxiv.org", "asana.com", "askubuntu.com", "asos.com",
    "atlassian.com", "audiomack.com", "australia.gov.au", "axios.com", "baidu.com",
    "bankofamerica.com", "barclays.co.uk", "bartleby.com", "bbc.co.uk", "bbc.com",
    "behance.net", "bestbuy.com", "binance.com", "bing.com", "biorxiv.org", "bitbucket.org",
    "bloomberg.com", "bls.gov", "bluehost.com", "booking.com", "box.com", "brainly.com",
    "brave.com", "brilliant.org", "britannica.com", "britishairways.com", "bsky.app",
    "businessinsider.com", "businessinsider.de", "buymeacoffee.com", "buzzfeed.com",
    "buzzfeednews.com", "bybit.com", "c-span.org", "canada.ca", "cancer.gov", "canva.com",
    "capitalone.com", "cash.app", "cbssports.com", "cdc.gov", "census.gov", "character.ai",
    "chase.com", "chatgpt.com", "chaturbate.com", "chegg.com", "chess.com", "chime.com",
    "citi.com", "citibank.com", "claude.ai", "clickup.com", "cliffsnotes.com",
    "cloud.microsoft", "cloudflare.com", "cnbc.com", "cnn.com", "coda.io", "codecademy.com",
    "coinbase.com", "coingecko.com", "coinmarketcap.com", "commerzbank.de", "confluence.com",
    "congress.gov", "costco.com", "coursehero.com", "coursera.org", "courtlistener.com",
    "craigslist.org", "crates.io", "crunchbase.com", "crunchyroll.com", "crypto.com",
    "css-tricks.com", "dailymail.co.uk", "dailymotion.com", "data.gov", "datacamp.com",
    "debian.org", "deepl.com", "deezer.com", "delta.com", "depop.com", "deutsche-bank.de",
    "dev.to", "developer.chrome.com", "deviantart.com", "diagrams.net", "dictionary.com",
    "diffchecker.com", "digitalocean.com", "digitaltrends.com", "discogs.com", "discord.com",
    "discord.gg", "discover.com", "disneyplus.com", "doordash.com", "draw.io", "dreamhost.com",
    "dribbble.com", "dropbox.com", "duckduckgo.com", "duolingo.com", "dw.com", "ea.com",
    "easyjet.com", "ebay.com", "ecfr.gov", "ecfr.io", "economist.com", "edx.org", "element.io",
    "elevenlabs.io", "emirates.com", "energy.gov", "engadget.com", "epa.gov", "epicgames.com",
    "espn.com", "etrade.com", "etsy.com", "eurogamer.net", "europa.eu", "evernote.com",
    "every.to", "expedia.com", "facebook.com", "fandom.com", "fansly.com", "fastly.com",
    "fcc.gov", "fda.gov", "fec.gov", "federalregister.gov", "fidelity.com", "fifa.com",
    "figma.com", "fiverr.com", "flickr.com", "fly.io", "forbes.com", "formula1.com",
    "foxsports.com", "france24.com", "freebsd.org", "freecodecamp.org", "freelancer.com",
    "freshdesk.com", "freshworks.com", "ft.com", "ftc.gov", "gab.ai", "gab.com",
    "gamespot.com", "gamesradar.com", "gao.gov", "geeksforgeeks.org", "gemini.com",
    "genius.com", "genome.gov", "gettr.com", "ghost.org", "giphy.com", "github.com",
    "gizmodo.com", "glassdoor.com", "glitch.me", "gnu.org", "go.dev", "goal.com", "goat.com",
    "godaddy.com", "gofundme.com", "gog.com", "golang.org", "goodreads.com", "google.com",
    "gotomeeting.com", "gov.uk", "govinfo.gov", "grailed.com", "grammarly.com", "grubhub.com",
    "gumtree.com", "halifax.co.uk", "haskell.org", "hbomax.com", "here.com", "heroku.com",
    "hilton.com", "hostelworld.com", "hostgator.com", "hotels.com", "hsbc.co.uk", "hsbc.com",
    "hubspot.com", "huffpost.com", "huggingface.co", "hulu.com", "hyatt.com", "ibm.com",
    "icloud.com", "ietf.org", "ign.com", "ihg.com", "ikea.com", "imdb.com", "imf.org",
    "imgur.com", "indeed.com", "independent.co.uk", "india.gov.in", "indiegogo.com", "ing.de",
    "insider.com", "instacart.com", "instagram.com", "interactivebrokers.com", "intercom.com",
    "invisionapp.com", "irs.gov", "issuu.com", "jetblue.com", "jira.com", "jquery.com",
    "jstor.org", "kaggle.com", "kagi.com", "kayak.com", "kayak.de", "kernel.org",
    "kickstarter.com", "kijiji.ca", "klm.com", "ko-fi.com", "kotaku.com", "kotlinlang.org",
    "kraken.com", "kucoin.com", "last.fm", "latimes.com", "lefigaro.fr", "lemonde.fr",
    "lennysnewsletter.com", "leonardo.ai", "letterboxd.com", "lichess.org", "linguee.com",
    "linkedin.com", "linode.com", "live.com", "lloydsbank.com", "lowes.com", "lucid.co",
    "lucidchart.com", "lufthansa.com", "lwn.net", "lyft.com", "macys.com", "mapbox.com",
    "marketwatch.com", "marriott.com", "mastodon.social", "mattermost.com", "max.com",
    "mdn.dev", "mediafire.com", "mediamarkt.de", "medium.com", "medlineplus.gov", "mega.nz",
    "mercari.com", "metro.co.uk", "microsoft.com", "microsoft365.com", "midjourney.com",
    "minds.com", "minecraft.net", "miro.com", "mirror.co.uk", "mlb.com", "mojeek.com",
    "monday.com", "monster.com", "monzo.com", "morningstar.com", "mozilla.org", "msn.com",
    "mural.co", "my.gov.au", "n26.com", "namecheap.com", "nasa.gov", "nationwide.co.uk",
    "nature.com", "natwest.com", "nba.com", "nbcnews.com", "netflix.com", "newsweek.com",
    "newyorker.com", "nextdoor.com", "nih.gov", "nintendolife.com", "nist.gov", "noaa.gov",
    "nordstrom.com", "notboring.co", "notion.com", "notion.site", "notion.so", "npmjs.com",
    "nuget.org", "nypost.com", "nytimes.com", "observablehq.com", "obsidian.md", "oecd.org",
    "office.com", "office365.com", "ok.ru", "okx.com", "olx.com", "onenote.com", "openai.com",
    "opencollective.com", "openstreetmap.org", "opentable.com", "oracle.com", "otto.de",
    "oup.com", "outlook.com", "packagist.org", "pages.dev", "paperswithcode.com",
    "paramountplus.com", "parler.com", "paste.ee", "pastebin.com", "patreon.com", "paypal.com",
    "paypal.me", "pcgamer.com", "pcmag.com", "peacocktv.com", "people.com", "perl.org",
    "perplexity.ai", "photomath.com", "php.net", "pika.art", "pinterest.com",
    "pluralsight.com", "pnc.com", "poe.com", "politico.com", "polygon.com", "pornhub.com",
    "poshmark.com", "postgresql.org", "primevideo.com", "protocol.com", "pypi.org",
    "python.org", "quillbot.com", "quizlet.com", "quora.com", "railway.app", "railway.com",
    "rateyourmusic.com", "realtor.com", "reddit.com", "redfin.com", "redtube.com",
    "regex101.com", "remove.bg", "render.com", "repl.it", "replit.com", "researchgate.net",
    "restofworld.org", "reuters.com", "reverso.net", "revolut.com", "roamresearch.com",
    "robinhood.com", "roblox.com", "rockpapershotgun.com", "rottentomatoes.com",
    "rubygems.org", "runway.com", "runwayml.com", "ryanair.com", "salesforce.com",
    "santander.co.uk", "sap.com", "schwab.com", "sci-hub.se", "science.org",
    "sciencedirect.com", "scribd.com", "searx.be", "sec.gov", "seekingalpha.com",
    "semanticscholar.org", "serverfault.com", "servicenow.com", "sharepoint.com", "shein.com",
    "shopify.com", "siteground.com", "sive.rs", "sketch.com", "skillshare.com", "skype.com",
    "skyscanner.de", "skyscanner.net", "skysports.com", "slack.com", "slashdot.org",
    "slideshare.net", "smashingmagazine.com", "sololearn.com", "soundcloud.com",
    "sourceforge.net", "southwest.com", "sparkasse.de", "sparknotes.com", "spiegel.de",
    "spotify.com", "springer.com", "squarespace.com", "squareup.com", "ssrn.com",
    "stability.ai", "stackexchange.com", "stackoverflow.com", "standardebooks.org",
    "startpage.com", "state.gov", "statista.com", "steamcommunity.com", "steampowered.com",
    "stockx.com", "stripchat.com", "stripe.com", "substack.com", "sueddeutsche.de", "suno.com",
    "superuser.com", "symbolab.com", "t.me", "target.com", "techcrunch.com", "techradar.com",
    "techstars.com", "telegram.me", "telegram.org", "telegraph.co.uk", "temu.com", "tenor.com",
    "theathletic.com", "theatlantic.com", "theconversation.com", "theguardian.com",
    "thehill.com", "theinformation.com", "thesaurus.com", "theverge.com", "threads.com",
    "threads.net", "tiktok.com", "tildes.net", "time.com", "tinypng.com", "todoist.com",
    "tomshardware.com", "tradingview.com", "trello.com", "tripadvisor.com", "truist.com",
    "trulia.com", "tumblr.com", "tutorialspoint.com", "twitch.tv", "twitter.com", "uber.com",
    "ubereats.com", "ubisoft.com", "ubuntu.com", "udacity.com", "udemy.com", "uefa.com",
    "un.org", "united.com", "unsplash.com", "upwork.com", "usa.gov", "uscourts.gov",
    "venmo.com", "venturebeat.com", "vercel.app", "vercel.com", "vice.com", "vimeo.com",
    "vinted.com", "vk.com", "vocabulary.com", "vox.com", "vuejs.org", "vultr.com",
    "w3schools.com", "walmart.com", "washingtonpost.com", "wayfair.com", "waze.com",
    "weather.com", "web.dev", "webex.com", "webflow.com", "weebly.com", "weibo.com",
    "wellfound.com", "wellsfargo.com", "welt.de", "wetransfer.com", "whatsapp.com",
    "whitehouse.gov", "who.int", "wikihow.com", "wired.com", "wise.com", "wix.com",
    "wolframalpha.com", "wordpress.com", "wordpress.org", "wordreference.com", "workday.com",
    "worldbank.org", "wsj.com", "wto.org", "wunderground.com", "x.com", "xbox.com",
    "xda-developers.com", "xhamster.com", "xnxx.com", "xvideos.com", "yahoo.com", "yandex.com",
    "ycombinator.com", "yelp.com", "youporn.com", "youtube.com", "zalando.co.uk", "zalando.de",
    "zdnet.com", "zelle.com", "zendesk.com", "zendesk.de", "zillow.com", "ziprecruiter.com",
    "zomato.com", "zoom.us",
  ];

  // Runtime downgrades: a host whose preview was actually seen to fail this
  // session. Never persisted.
  var SEEN_BAD = Object.create(null);

  function endsWithHost(host, suffix) {
    return host === suffix || host.slice(-(suffix.length + 1)) === "." + suffix;
  }

  function normHost(host) {
    if (typeof host !== "string" || !host) return "";
    return host.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  }

  function longestMatch(host, list) {
    var best = 0;
    for (var i = 0; i < list.length; i++) {
      if (list[i].length > best && endsWithHost(host, list[i])) best = list[i].length;
    }
    return best;
  }

  function classify(host) {
    host = normHost(host);
    if (!host) return "unknown";
    if (SEEN_BAD[host]) return "bad";
    var g = longestMatch(host, GOOD);
    var b = longestMatch(host, BAD);
    // The more specific (longer) suffix wins, so a frame-friendly sub-domain of
    // an otherwise-blocked host (docs.python.org, doc.rust-lang.org) still previews.
    if (g && g > b) return "good";
    if (b) return "bad";
    if (g) return "good";
    return "unknown";
  }

  // Called by the viewer when a preview iframe demonstrably failed to render, so
  // the rest of the session stops auto-previewing that host.
  function remember(host, verdict) {
    host = normHost(host);
    if (host && verdict === "bad") SEEN_BAD[host] = true;
  }

  root.FrameHosts = { classify: classify, remember: remember };
})(typeof self !== "undefined" ? self : this);
