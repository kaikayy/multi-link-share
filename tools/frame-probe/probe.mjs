import { readFileSync, writeFileSync } from "node:fs";

const domains = readFileSync(process.argv[2], "utf8")
  .split("\n").map((s) => s.trim()).filter((s) => s && !s.startsWith("#"));

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const CONCURRENCY = 20;
const TIMEOUT = 15000;

function classify(xfo, csp, status) {
  const fa = (csp || "").toLowerCase().match(/frame-ancestors([^;]*)/);
  if (fa) {
    const val = fa[1].trim();
    if (/(^|\s)\*(\s|$)/.test(val) && !/'none'/.test(val)) return "good";
    return "bad"; // 'none', 'self', or an explicit allowlist that won't include us
  }
  if (xfo) {
    const v = xfo.toLowerCase();
    if (v.includes("allowall")) return "good";
    if (v.includes("deny") || v.includes("sameorigin") || v.includes("allow-from")) return "bad";
  }
  if (status === 401) return "bad"; // auth wall — nothing to preview
  return "good"; // no anti-framing headers seen
}

async function probe(domain) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch("https://" + domain + "/", {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    clearTimeout(t);
    try { await res.body?.cancel(); } catch {}
    const xfo = res.headers.get("x-frame-options");
    const csp = res.headers.get("content-security-policy");
    const status = res.status;
    const finalHost = (() => { try { return new URL(res.url).host.replace(/^www\./, ""); } catch { return domain; } })();

    if (status === 403 || status === 429 || status === 503 || status >= 500) {
      return { domain, verdict: "skip", status, reason: "bot-wall/5xx", finalHost };
    }
    const verdict = classify(xfo, csp, status);
    return { domain, verdict, status, xfo: xfo || "", csp: csp ? (csp.match(/frame-ancestors[^;]*/i)?.[0] || "csp(no-fa)") : "", finalHost };
  } catch (e) {
    clearTimeout(t);
    return { domain, verdict: "skip", status: 0, reason: (e.cause?.code || e.name || "err"), finalHost: domain };
  }
}

const results = [];
let i = 0;
async function worker() {
  while (i < domains.length) {
    const d = domains[i++];
    const r = await probe(d);
    results.push(r);
    process.stdout.write(`${r.verdict[0].toUpperCase()} `);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
process.stdout.write("\n");

results.sort((a, b) => a.domain.localeCompare(b.domain));
writeFileSync(process.argv[3] || "results.json", JSON.stringify(results, null, 1));

const by = (v) => results.filter((r) => r.verdict === v);
console.log(`\ntotal ${results.length}  good ${by("good").length}  bad ${by("bad").length}  skip ${by("skip").length}`);
console.log("\n--- GOOD (framing allowed) ---");
console.log(by("good").map((r) => r.domain).join("\n"));
console.log("\n--- SKIP (couldn't determine) ---");
console.log(by("skip").map((r) => `${r.domain} (${r.reason || r.status})`).join("\n"));
