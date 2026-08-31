import { readFileSync } from "node:fs";

const r1 = JSON.parse(readFileSync("results.json", "utf8"));
const r2 = JSON.parse(readFileSync("results2.json", "utf8"));
const all = [...r1, ...r2];

const MULTI_TLD = new Set([
  "co.uk", "org.uk", "gov.uk", "ac.uk", "me.uk", "ltd.uk", "plc.uk", "net.uk",
  "co.jp", "ne.jp", "or.jp", "go.jp", "ac.jp",
  "com.au", "net.au", "org.au", "gov.au", "edu.au", "id.au",
  "co.nz", "com.br", "com.mx", "co.za", "com.tr", "com.cn", "com.hk", "com.sg",
  "co.in", "gov.in", "co.kr", "com.ua",
]);
// keep these at full host (reducing them would over-broaden to a shared domain)
const KEEP_FULL = new Set([
  "plato.stanford.edu", "ocw.mit.edu", "iep.utm.edu", "abcnews.go.com",
  "html.spec.whatwg.org", "doc.rust-lang.org", "docs.python.org",
  "docs.oracle.com", "developer.chrome.com", "commons.wikimedia.org",
  "en.wikipedia.org", "web.archive.org", "cran.r-project.org",
]);
function reg(host) {
  host = host.toLowerCase().replace(/^www\./, "");
  if (KEEP_FULL.has(host)) return host;
  const p = host.split(".");
  if (p.length <= 2) return host;
  const last2 = p.slice(-2).join(".");
  if (MULTI_TLD.has(last2)) return p.slice(-3).join(".");
  return last2;
}

// ---- manual overrides --------------------------------------------------

// probe returned a clean/headerless response but a real browser is blocked
// (CDN edge, JS frame-bust, or a login/consent wall makes the preview useless)
const FORCE_BAD = `
adobe.com microsoft.com sharepoint.com live.com office.com msn.com office365.com
zoom.us webex.com disneyplus.com hulu.com hbomax.com binance.com crypto.com
coinbase.com kraken.com imdb.com booking.com expedia.com hotels.com
tripadvisor.com yelp.com bestbuy.com costco.com target.com walmart.com
nordstrom.com asos.com temu.com aliexpress.com alibaba.com shein.com baidu.com
trello.com monday.com airtable.com asana.com todoist.com notion.so miro.com
mural.co clickup.com patreon.com gofundme.com kickstarter.com indiegogo.com
buymeacoffee.com ko-fi.com scribd.com slideshare.net issuu.com gettr.com
weibo.com vk.com ok.ru venmo.com cash.app zelle.com vinted.com kijiji.ca
olx.com zomato.com espn.com redfin.com zillow.com realtor.com trulia.com
telegraph.co.uk mirror.co.uk metro.co.uk dailymail.co.uk
amazon.com amazon.co.uk amazon.de amazon.co.jp amazon.in amazon.ca amazon.fr
amazon.es amazon.it amazon.com.br amazon.nl amazon.se
openai.com chatgpt.com claude.ai anthropic.com gemini.google.com character.ai
poe.com perplexity.ai midjourney.com leonardo.ai stability.ai runwayml.com
elevenlabs.io suno.com pika.art
stackoverflow.com stackexchange.com quora.com medium.com fandom.com
britannica.com economist.com ft.com bloomberg.com axios.com politico.com
thehill.com pcmag.com people.com venturebeat.com protocol.com
theinformation.com theverge.com wired.com theatlantic.com newyorker.com
time.com wsj.com nytimes.com washingtonpost.com cnn.com bbc.com reuters.com
apnews.com forbes.com businessinsider.com cnbc.com
ebay.com etsy.com canva.com coingecko.com coinmarketcap.com tradingview.com
glassdoor.com indeed.com ziprecruiter.com monster.com upwork.com fiverr.com
freelancer.com wellfound.com
doordash.com grubhub.com instacart.com ubereats.com opentable.com
wayfair.com stockx.com goat.com grailed.com depop.com poshmark.com mercari.com
craigslist.org gumtree.com
udemy.com skillshare.com datacamp.com quizlet.com brainly.com chegg.com
coursehero.com coursera.org edx.org udacity.com pluralsight.com codecademy.com
grammarly.com quillbot.com reverso.net deepl.com wordreference.com linguee.com
revolut.com chime.com wise.com n26.com monzo.com paypal.me
crunchyroll.com epicgames.com gog.com steampowered.com roblox.com
gamespot.com ign.com polygon.com kotaku.com
letterboxd.com discogs.com allmusic.com rateyourmusic.com
godaddy.com namecheap.com hostgator.com bluehost.com siteground.com dreamhost.com
squarespace.com wix.com weebly.com webflow.com shopify.com
oracle.com sap.com ibm.com salesforce.com workday.com servicenow.com
npmjs.com sourceforge.net vultr.com glitch.me linode.com heroku.com
researchgate.net academia.edu sciencedirect.com science.org ssrn.com imf.org
oecd.org academic.oup.com jstor.org springer.com nature.com sci-hub.se
aa.com delta.com united.com southwest.com jetblue.com ryanair.com easyjet.com
lufthansa.com airfrance.com klm.com britishairways.com emirates.com
marriott.com hilton.com hyatt.com ihg.com accor.com
usa.gov whitehouse.gov nasa.gov nih.gov cdc.gov irs.gov congress.gov
weather.com accuweather.com wunderground.com
`.split(/\s+/).filter(Boolean);

// framing-friendly sites the probe bot-walled / couldn't reach
const FORCE_GOOD = `

`.split(/\s+/).filter(Boolean);

// probe said good, but keep it out of AUTO preview (SPA / consent-wall / ad-heavy
// / marginal — better shown as the plain card with a "try preview" opt-in)
const DROP_GOOD = new Set([
  "adobe.com", "airtable.com", "monday.com", "trello.com", "todoist.com", "mural.co",
  "zoom.us", "microsoft.com", "sharepoint.com", "disneyplus.com", "hulu.com",
  "binance.com", "crypto.com", "temu.com", "aliexpress.com", "bestbuy.com", "costco.com",
  "nordstrom.com", "asos.com", "imdb.com", "booking.com", "espn.com", "redfin.com",
  "telegraph.co.uk", "mirror.co.uk", "dailymail.co.uk", "baidu.com", "patreon.com",
  "gofundme.com", "scribd.com", "slideshare.net", "gettr.com", "weibo.com", "venmo.com",
  "vinted.com", "kijiji.ca", "olx.com", "zomato.com", "tradingeconomics.com",
  "immobilienscout24.de", "rightmove.co.uk", "trulia.com", "zillow.com", "dice.com",
  "gog.com", "rockstargames.com", "wix.com", "squarespace.com", "netlify.com",
  "netlify.app", "stackblitz.com", "codesandbox.io", "hashnode.com", "hashnode.dev",
  // ad / consent heavy news + aggregators — plain card is the better default
  "foxnews.com", "cbsnews.com", "usatoday.com", "bild.de", "faz.net", "zeit.de",
  "repubblica.it", "corriere.it", "elmundo.es", "elpais.com", "thesun.co.uk",
  "newyorker.com", "theatlantic.com", "time.com", "wired.com", "cnet.com",
  "mashable.com", "macrumors.com", "anandtech.com", "lifehacker.com", "readwrite.com",
  "hackernoon.com", "bleacherreport.com", "nfl.com", "nhl.com", "metacritic.com",
  "accuweather.com", "weather.com", "wunderground.com", "citymapper.com",
  // finance / retail marginal
  "vanguard.com", "usbank.com", "dreamhost.com",
  // reduced-suffix noise we don't want as broad matches
  "go.com", "net.au", "js.org", "utm.edu", "stanford.edu", "mit.edu",
  // apps that technically render but aren't "pages people share to read"
  "khanacademy.org", "civitai.com", "bitchute.com", "pandora.com", "mixcloud.com",
  "500.co", "sequoiacap.com", "a16z.com", "adobe.io", "stratechery.com", "httpbin.org",
]);

// ---- build ------------------------------------------------------------

const bad = new Set();
for (const x of all)
  if (x.verdict === "bad") { bad.add(reg(x.finalHost || x.domain)); bad.add(reg(x.domain)); }
for (const d of FORCE_BAD) bad.add(reg(d));

const good = new Set();
for (const x of all)
  if (x.verdict === "good" && x.status === 200) {
    const g = reg(x.domain);
    if (!DROP_GOOD.has(g)) good.add(g);
  }
for (const d of FORCE_GOOD) good.add(reg(d));

// wiki family + a few evergreen reference/tool hosts are always good
const ALWAYS_GOOD = [
  "wikipedia.org", "wikimedia.org", "wiktionary.org", "wikibooks.org",
  "wikisource.org", "wikivoyage.org", "wikidata.org", "wikinews.org",
  "wikiquote.org", "mediawiki.org", "wikispecies.org",
  "example.com", "example.org", "example.net",
  "openstreetmap.org", // note: main map blocks, but /export & tiles embed; keep as try-worthy? -> leave out
];
for (const g of ALWAYS_GOOD) { if (g === "openstreetmap.org") continue; good.add(g); }
for (const g of [...good]) if (bad.has(g)) good.delete(g);

// scrub obviously-broad reduced suffixes from BAD too (harmless but ugly)
for (const junk of ["go.com", "goto.com", "now.sh", "js.org"]) bad.delete(junk);

const G = [...good].sort();
const B = [...bad].sort();
console.error(`GOOD ${G.length}   BAD ${B.length}`);

const wrap = (arr) => {
  const lines = [];
  let row = "    ";
  for (const d of arr) {
    const tok = `"${d}", `;
    if ((row + tok).length > 96) { lines.push(row.trimEnd()); row = "    "; }
    row += tok;
  }
  if (row.trim()) lines.push(row.trimEnd());
  return lines.join("\n");
};
console.log("// ---GOOD---");
console.log(wrap(G));
console.log("// ---BAD---");
console.log(wrap(B));
