/**
 * Devin Usage & Limits page scrape regression (no browser required).
 * Run: node scripts/test-devin-scrape.mjs
 */

const SAMPLE_TEXT =
  "Usage & Limits Overview Usage History Current plan Pro Trial for 14 days " +
  "Your included usage Daily quota 8% used Resets in 5 hours " +
  "Weekly quota 4% used Resets in 5 hours On-demand usage " +
  "Remaining balance $-0.10 No on-demand balance remaining.";

const SAMPLE_TEXT_USER =
  "Your included usage Daily quota 36% used Resets in 8 hours " +
  "Weekly quota 18% used Resets in 6 days On-demand usage Remaining balance $-0.10";

function parseDevinQuotaSection(text, kind) {
  const patterns =
    kind === "daily"
      ? [/Daily\s+quota/i, /日次\s*(?:クォータ|割当)?/i]
      : [/Weekly\s+quota/i, /週次\s*(?:クォータ|割当)?/i];
  let idx = -1;
  for (const pattern of patterns) {
    const found = text.search(pattern);
    if (found >= 0 && (idx < 0 || found < idx)) idx = found;
  }
  if (idx < 0) return null;
  const slice = text.slice(idx, idx + 240);
  const pctMatch =
    slice.match(/(\d{1,3})\s*%\s*used\b/i) ??
    slice.match(/(\d{1,3})\s*%\s*(?:使用|利用)/i) ??
    slice.match(/used\s*:?\s*(\d{1,3})\s*%/i);
  if (!pctMatch) return null;
  const resetAt =
    slice.match(/Resets\s+in\s+(\d+\s+hours?)/i)?.[1]?.trim() ??
    slice.match(/Resets\s+in\s+(\d+\s+days?)/i)?.[1]?.trim() ??
    slice.match(/Resets\s+in\s+(\d+\s+minutes?)/i)?.[1]?.trim();
  return { usedPercentage: Number(pctMatch[1]), resetAt };
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

  const dailySection = parseDevinQuotaSection(text, "daily");
  if (dailySection) {
    pushMetric(metrics, "devin", "Daily quota", dailySection.usedPercentage, dailySection.resetAt);
  }

  const weeklySection = parseDevinQuotaSection(text, "weekly");
  if (weeklySection) {
    pushMetric(metrics, "devin", "Weekly quota", weeklySection.usedPercentage, weeklySection.resetAt);
  }

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

const userMetrics = devinMetricsFromText(SAMPLE_TEXT_USER);
const userDaily = userMetrics.find((m) => m.id === "devin-daily-quota");
const userWeekly = userMetrics.find((m) => m.id === "devin-weekly-quota");
if (userDaily?.usedPercentage !== 36 || userWeekly?.usedPercentage !== 18) {
  console.error("FAIL scrape user sample", userMetrics);
  failed++;
} else if (userDaily.resetAt !== "8 hours" || userWeekly.resetAt !== "6 days") {
  console.error("FAIL scrape user resets", userDaily, userWeekly);
  failed++;
} else {
  console.log("OK scrape user sample: daily=36%/8h, weekly=18%/6d");
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
