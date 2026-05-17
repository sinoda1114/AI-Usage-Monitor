/**
 * Devin Usage & Limits page scrape regression (no browser required).
 * Run: node scripts/test-devin-scrape.mjs
 */

const SAMPLE_TEXT =
  "Usage & Limits Overview Usage History Current plan Pro Trial for 14 days " +
  "Your included usage Daily quota 8% used Resets in 5 hours " +
  "Weekly quota 4% used Resets in 5 hours On-demand usage " +
  "Remaining balance $-0.10 No on-demand balance remaining.";

function findReset(text) {
  const reset =
    text.match(/Resets\s+in\s+([^\n.,;]{2,40})/i)?.[1]?.trim() ??
    text.match(/(?:Resets on|Reset on|リセット)[^\d一-龠ぁ-んァ-ン]{0,10}([^。,.|]{2,32}?)(?=\s+(?:Total|Auto|API|Included|On-Demand|$))/i)?.[1]?.trim() ??
    text.match(/(?:Reset|Resets|リセット)[^\d一-龠ぁ-んァ-ン]{0,10}([^。,.|]{2,32}?)(?=\s+(?:Total|Auto|API|Included|On-Demand|$))/i)?.[1]?.trim() ??
    text.match(/(\d+\s*(?:days?|日)後?[^\s。,.|]{0,16})/)?.[1]?.trim();
  return reset?.replace(/\s+(?:Total|Auto \+ Composer|API|Included|On-Demand).*$/i, "").trim();
}

function metricId(provider, label) {
  if (provider === "devin" && /daily\s*quota/i.test(label)) return "devin-daily-quota";
  if (provider === "devin" && /weekly\s*quota/i.test(label)) return "devin-weekly-quota";
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${provider}-${slug || "usage"}`;
}

function pushMetric(metrics, provider, label, usedPercentage, resetAt, detail) {
  if (!Number.isFinite(usedPercentage)) return;
  const cleanLabel = label.replace(/used|使用済み|利用済み/gi, "").replace(/[:：|/]+$/g, "").trim().slice(-48) || "Usage";
  const id = metricId(provider, cleanLabel);
  if (metrics.some((m) => m.id === id)) return;
  metrics.push({
    id,
    label: cleanLabel,
    usedPercentage: Math.max(0, Math.min(100, Math.round(usedPercentage))),
    resetAt: resetAt === null ? undefined : resetAt,
    detail,
  });
}

function devinMetricsFromText(text) {
  const metrics = [];
  const resetAt = findReset(text);

  const daily =
    text.match(/Daily\s+quota\s*:?\s*(\d{1,3})\s*%\s*used\b/i) ??
    text.match(/Daily\s+quota[^0-9]{0,120}(\d{1,3})\s*%\s*used\b/i);
  if (daily) pushMetric(metrics, "devin", "Daily quota", Number(daily[1]), resetAt);

  const weekly =
    text.match(/Weekly\s+quota\s*:?\s*(\d{1,3})\s*%\s*used\b/i) ??
    text.match(/Weekly\s+quota[^0-9]{0,120}(\d{1,3})\s*%\s*used\b/i);
  if (weekly) pushMetric(metrics, "devin", "Weekly quota", Number(weekly[1]), resetAt);

  const onDemandBal = text.match(/Remaining\s+balance\s*:?\s*\$?\s*([\-\d.,]+)/i);
  if (onDemandBal) {
    metrics.push({
      id: "devin-on-demand-balance",
      label: "On-demand balance",
      usedPercentage: null,
      detail: `$${onDemandBal[1].replace(/,/g, "")}`,
    });
  }
  return metrics;
}

function isDevinUsagePath(pathname) {
  const p = (pathname || "").replace(/\/+$/, "") || "";
  if (/\/settings\/usage$/i.test(p)) return true;
  if (/\/settings\/usage-and-limits$/i.test(p)) return true;
  if (/\/settings\/[^/]*usage/i.test(p)) return true;
  return false;
}

function resolveProviderFromUrl(href, storedSlug) {
  const u = new URL(href);
  if (u.hostname !== "app.devin.ai") return null;
  const path = decodeURIComponent((u.pathname || "").replace(/\/+$/, "") || "");
  const pathSlug = path.match(/^\/org\/([a-zA-Z0-9_-]+)/)?.[1];
  if (pathSlug && isDevinUsagePath(path)) return "devin";
  const configured = String(storedSlug ?? "").trim();
  const slug = configured || pathSlug;
  if (!slug) return null;
  const seg = `/org/${slug}`;
  if (path === seg || path.startsWith(`${seg}/`)) return "devin";
  return null;
}

function mergePopupProviderPrefs(raw) {
  const DEFAULT = {
    cursor: { visible: true, order: 1 },
    codex: { visible: true, order: 2 },
    claude: { visible: true, order: 3 },
    devin: { visible: false, order: 4 },
  };
  const merged = {};
  for (const key of Object.keys(DEFAULT)) {
    const patch = raw?.[key] && typeof raw[key] === "object" ? raw[key] : {};
    merged[key] = { ...DEFAULT[key], ...patch };
    if (typeof merged[key].visible !== "boolean") merged[key].visible = DEFAULT[key].visible;
  }
  return merged;
}

function isProviderVisible(providerKey, prefs) {
  const value = prefs?.[providerKey];
  if (!value) return false;
  return value.visible !== false;
}

function renderProviderKeys(store, prefs) {
  return Object.entries(store?.providers ?? {})
    .filter(([k]) => isProviderVisible(k, prefs))
    .map(([k]) => k);
}

let failed = 0;

const metrics = devinMetricsFromText(SAMPLE_TEXT);
if (metrics.length < 3) {
  console.error("FAIL scrape: expected >=3 metrics, got", metrics);
  failed++;
} else {
  const daily = metrics.find((m) => m.id === "devin-daily-quota");
  const weekly = metrics.find((m) => m.id === "devin-weekly-quota");
  if (daily?.usedPercentage !== 8 || weekly?.usedPercentage !== 4) {
    console.error("FAIL scrape percentages", metrics);
    failed++;
  } else {
    console.log("OK scrape:", metrics.map((m) => `${m.label}=${m.usedPercentage ?? m.detail}`).join(", "));
  }
}

const url = "https://app.devin.ai/org/my-org/settings/usage";
if (resolveProviderFromUrl(url, "") !== "devin") {
  console.error("FAIL resolveProvider: should work without stored slug on usage URL");
  failed++;
} else {
  console.log("OK resolveProvider without stored slug");
}

if (resolveProviderFromUrl(url, "other-org") !== "devin") {
  console.error("FAIL resolveProvider: usage URL should match org in path, not settings slug");
  failed++;
} else {
  console.log("OK resolveProvider ignores mismatched settings slug on usage URL");
}

const prefs = mergePopupProviderPrefs({ devin: { visible: true, order: 1 } });
const store = {
  providers: {
    cursor: {},
    devin: { provider: "devin", metrics },
  },
};
const keys = renderProviderKeys(store, prefs);
if (!keys.includes("devin")) {
  console.error("FAIL popup filter: devin not visible", keys, prefs);
  failed++;
} else {
  console.log("OK popup filter includes devin");
}

if (mergePopupProviderPrefs({ devin: {} }).devin.visible !== false) {
  console.error("FAIL merge: empty devin patch should default visible false");
  failed++;
}

process.exit(failed > 0 ? 1 : 0);
