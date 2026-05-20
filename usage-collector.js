/** Collects usage metrics only; no on-page UI (does not load i18n.js). */
const CONTENT_BUILD = "0.5.3";

let collectorAlive = true;
let observer = null;

if (globalThis.__aiUsageContentBuild && globalThis.__aiUsageContentBuild !== CONTENT_BUILD) {
  console.info(
    "[AI Usage Monitor] Extension was updated. Reload this tab (F5) to clear the old collector."
  );
}
globalThis.__aiUsageContentBuild = CONTENT_BUILD;

window.addEventListener("unhandledrejection", (event) => {
  const reason = String(event.reason?.message || event.reason || "");
  if (reason.includes("A listener indicated an asynchronous response by returning true")) {
    event.preventDefault();
    return;
  }
  if (!reason.includes("Extension context invalidated")) return;
  event.preventDefault();
  stopCollector("unhandled rejection: context invalidated");
});

function isExtensionContextAlive() {
  try {
    return Boolean(chrome?.runtime?.id);
  } catch {
    return false;
  }
}

function isContextInvalidatedError(error) {
  const message = String(error?.message || error || "");
  return (
    message.includes("Extension context invalidated") ||
    message.includes("Receiving end does not exist") ||
    message.includes("Cannot read properties of undefined (reading 'sendMessage')") ||
    message.includes("Cannot read properties of undefined (reading 'id')") ||
    message.includes("Cannot read properties of undefined (reading 'local')")
  );
}

function stopCollector(reason) {
  if (!collectorAlive) return;
  collectorAlive = false;
  detachObserver();
  console.info("[AI Usage Monitor] stopped collector loop:", reason);
}

function isDevinUsagePath(pathname) {
  const p = (pathname || "").replace(/\/+$/, "") || "";
  if (/\/settings\/usage-and-limits$/i.test(p)) return true;
  if (/\/settings\/usage$/i.test(p)) return true;
  if (/\/settings\/[^/]*usage/i.test(p)) return true;
  if (/^\/org\/[^/]+\/usage(?:-and-limits)?$/i.test(p)) return true;
  return false;
}

function isDevinHost(hostname) {
  return hostname === "app.devin.ai" || hostname.endsWith(".devin.ai");
}

function isClaudeUsagePage(href) {
  try {
    const u = new URL(href);
    if (u.hostname !== "claude.ai") return false;
    if (/\/settings\/usage/i.test(u.pathname)) return true;
    if (/settings\/usage/i.test(u.hash || "")) return true;
    return false;
  } catch {
    return false;
  }
}

async function resolveProvider() {
  const href = window.location.href;
  try {
    const u = new URL(href);

    if (u.hostname.includes("cursor.com")) return "cursor";
    if (href.includes("chatgpt.com/codex")) return "codex";
    if (isClaudeUsagePage(href)) return "claude";

    if (!isDevinHost(u.hostname)) return null;

    const path = decodeURIComponent((u.pathname || "").replace(/\/+$/, "") || "");
    const pathSlug = path.match(/^\/org\/([a-zA-Z0-9_-]+)/)?.[1];

    if (pathSlug && isDevinUsagePath(path)) return "devin";

    if (!isExtensionContextAlive()) return null;
    const { devinOrgSlug } = await chrome.storage.local.get("devinOrgSlug");
    const configured = String(devinOrgSlug ?? "").trim();
    const slug = configured || pathSlug;
    if (!slug) return null;

    const seg = `/org/${slug}`;

    const authLike = /\/auth|\/login|\/signin|\/signup/i.test(path);
    if (authLike) {
      const keys = ["redirect", "next", "returnUrl", "return_url"];
      for (const key of keys) {
        const raw = u.searchParams.get(key);
        if (!raw) continue;
        try {
          const dec = decodeURIComponent(raw);
          if (dec.includes(seg)) return "devin";
        } catch {
          if (raw.includes(slug)) return "devin";
        }
      }
      try {
        const full = decodeURIComponent(href);
        if (full.includes(seg)) return "devin";
      } catch {
        if (href.includes(slug)) return "devin";
      }
    }
  } catch {
    return null;
  }

  return null;
}

function compactText() {
  const parts = [];
  const seen = new WeakSet();

  function walk(node) {
    if (!node || seen.has(node)) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.textContent?.replace(/\s+/g, " ").trim();
      if (value) parts.push(value);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node;
    seen.add(el);
    if (el.shadowRoot) walk(el.shadowRoot);
    for (const child of el.childNodes) walk(child);
  }

  if (document.body) walk(document.body);
  const joined = parts.join(" ").replace(/\s+/g, " ").trim();
  if (joined) return joined;
  return (document.body?.innerText ?? "").replace(/\s+/g, " ").trim();
}

function findReset(text) {
  const resetsIn = text.match(/Resets\s+in\s+([^\n.,;|]{2,40})/i)?.[1]?.trim();
  if (resetsIn) return resetsIn;

  const resetsOn =
    text.match(/Resets\s+on\s+(\d{1,2}\s*月\s*\d{1,2}\s*日(?:\s*\([^)]*\))?)/i)?.[1]?.trim() ??
    text.match(/Resets\s+on\s+([A-Za-z]{3,9}\s+\d{1,2}(?:\s*\([^)]*\))?)/i)?.[1]?.trim() ??
    text.match(/Resets\s+on\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?:\s*\([^)]*\))?)/i)?.[1]?.trim();
  if (resetsOn) return resetsOn;

  const relative =
    text.match(/(\d+)\s*(?:days?\s*later|日後)/i) ?? text.match(/あと\s*(\d+)\s*日/);
  if (relative) return `${relative[1]} days`;

  return undefined;
}

/** Cursor spending: avoid matching "14 日間の無料トライアル" as reset. */
function findCursorReset(text) {
  return (
    text.match(/Resets\s+on\s+(\d{1,2}\s*月\s*\d{1,2}\s*日(?:\s*\([^)]*\))?)/i)?.[1]?.trim() ??
    text.match(/Resets\s+on\s+([A-Za-z]{3,9}\s+\d{1,2}(?:\s*\([^)]*\))?)/i)?.[1]?.trim() ??
    text.match(/Resets\s+on\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?:\s*\([^)]*\))?)/i)?.[1]?.trim() ??
    text.match(/Resets\s+in\s+([^\n.,;|]{2,36})/i)?.[1]?.trim()
  );
}

function metricId(provider, label) {
  if (provider === "codex" && /5\s*時間|5[-\s]*hour/i.test(label)) return "codex-five-hour";
  if (provider === "codex" && /週あたり|weekly/i.test(label)) return "codex-weekly";
  if (provider === "claude" && /現在のセッション|current session/i.test(label)) return "claude-current-session";
  if (provider === "claude" && /週間制限|weekly|すべてのモデル/i.test(label)) return "claude-weekly";
  if (provider === "claude" && /ルーティン|routine/i.test(label)) return "claude-routines";
  if (provider === "claude" && /追加使用量|extra/i.test(label)) return "claude-extra";
  if (provider === "claude" && /claude\s*design/i.test(label)) return "claude-design";
  if (provider === "devin" && /daily\s*quota/i.test(label)) return "devin-daily-quota";
  if (provider === "devin" && /weekly\s*quota/i.test(label)) return "devin-weekly-quota";
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${provider}-${slug || "usage"}`;
}

function pushMetric(metrics, provider, label, usedPercentage, resetAt, detail) {
  if (!Number.isFinite(usedPercentage)) return;
  const cleanLabel = label
    .replace(/used|使用済み|利用済み/gi, "")
    .replace(/[:：|/]+$/g, "")
    .trim()
    .slice(-48) || "Usage";
  const id = metricId(provider, cleanLabel);
  if (metrics.some((metric) => metric.id === id)) return;
  metrics.push({
    id,
    label: cleanLabel,
    usedPercentage: Math.max(0, Math.min(100, Math.round(usedPercentage))),
    resetAt: resetAt === null ? undefined : resetAt,
    detail,
  });
}

function metricsFromBars(provider) {
  const metrics = [];
  const text = compactText();
  const resetAt = findReset(text);

  if (provider === "cursor") {
    const cursorReset = findCursorReset(text);
    const total = text.match(/(?:Included in Pro\s+)?Total\s+(\d{1,3})\s*%/i);
    if (total) pushMetric(metrics, provider, "Total", Number(total[1]), cursorReset);

    const auto =
      text.match(/Auto\s*\+\s*Composer\s+(\d{1,3})\s*%/i) ??
      text.match(/(\d{1,3})\s*%\s*Auto(?:\s+and|\s|$)/i);
    if (auto) pushMetric(metrics, provider, "Auto + Composer", Number(auto[1]), cursorReset);

    const api =
      text.match(/API\s+(\d{1,3})\s*%/i) ??
      text.match(/(\d{1,3})\s*%\s*API\s+used/i);
    if (api) pushMetric(metrics, provider, "API", Number(api[1]), cursorReset);

    if (metrics.length > 0) return metrics;
  }

  if (provider === "codex") {
    const fiveHour =
      text.match(
        /5\s*時間の使用制限\s+(\d{1,3})\s*%\s*(残り|使用済み)?[^リ]*(?:リセット[:：]\s*([^\s]+))?/i
      ) ??
      text.match(
        /5[-\s]*hour(?:ly)?\s+(?:usage\s+)?limit[^0-9]{0,48}(\d{1,3})\s*%\s*(remaining|used)?[^.]{0,48}(?:reset(?:s)?(?:\s+on)?[:：]?\s*([^\s,.|]+))?/i
      );
    if (fiveHour) {
      const label = /5\s*時間/.test(text) ? "5時間の使用制限" : "5-hour usage limit";
      pushMetric(metrics, provider, label, codexUsed(Number(fiveHour[1]), fiveHour[2]), fiveHour[3] ?? resetAt);
    }

    const weekly =
      text.match(
        /週あたりの使用制限\s+(\d{1,3})\s*%\s*(残り|使用済み)?[^リ]*(?:リセット[:：]\s*([^\s]+(?:\s+[^\s]+)?))?/i
      ) ??
      text.match(
        /weekly\s+(?:usage\s+)?limit[^0-9]{0,48}(\d{1,3})\s*%\s*(remaining|used)?[^.]{0,48}(?:reset(?:s)?(?:\s+on)?[:：]?\s*([^\s,.|]+(?:\s+[^\s,.|]+)?))?/i
      );
    if (weekly) {
      const label = /週あたり/.test(text) ? "週あたりの使用制限" : "Weekly usage limit";
      pushMetric(metrics, provider, label, codexUsed(Number(weekly[1]), weekly[2]), weekly[3] ?? resetAt);
    }

    const credits =
      text.match(/残りのクレジット\s+(\d+(?:\.\d+)?)/) ??
      text.match(/(?:credits?\s+)?remaining[^0-9]{0,24}(\d+(?:\.\d+)?)/i);
    if (credits) {
      const label = /残りのクレジット/.test(text) ? "残りのクレジット" : "Credits remaining";
      metrics.push({
        id: "codex-credits",
        label,
        usedPercentage: null,
        detail: credits[1],
      });
    }

    if (metrics.length > 0) return metrics;
  }

  if (provider === "claude") {
    const current =
      text.match(/現在のセッション\s+([^%]{0,160}?)(\d{1,3})\s*%\s*使用済み/i) ??
      text.match(/current session\s+([^%]{0,160}?)(\d{1,3})\s*%\s*(?:used|使用)/i);
    if (current) pushMetric(metrics, provider, "現在のセッション", Number(current[2]), resetFromSection(current[1]) ?? null);

    const weekly =
      text.match(/週間制限\s+([^%]{0,220}?)(\d{1,3})\s*%\s*使用済み/i) ??
      text.match(/すべてのモデル\s+([^%]{0,160}?)(\d{1,3})\s*%\s*使用済み/i) ??
      text.match(/weekly\s+([^%]{0,180}?)(\d{1,3})\s*%\s*(?:used|使用)/i);
    if (weekly) pushMetric(metrics, provider, "週間制限", Number(weekly[2]), resetFromSection(weekly[1]) ?? resetAt);

    const claudeDesign =
      text.match(/Claude\s*Design\s+([^%]{0,220}?)(\d{1,3})\s*%\s*(?:使用済み|used|使用)/i) ??
      text.match(/Claude\s*Design([^%]{0,220}?)(\d{1,3})\s*%\s*(?:使用済み|used|使用)/i);
    if (claudeDesign) {
      const usedPercentage = Number(claudeDesign[2]);
      pushMetric(metrics, provider, "Claude Design", usedPercentage, resetFromSection(claudeDesign[1]));
    }

    const routines =
      text.match(/(?:ルーティン実行数|routine runs?)[^0-9]{0,80}(\d+)\s*\/\s*(\d+)/i) ??
      text.match(/(?:included\s+)?routine\s+runs?[^0-9]{0,80}(\d+)\s*\/\s*(\d+)/i);
    if (routines) {
      const used = Number(routines[1]);
      const limit = Number(routines[2]);
      const label = /ルーティン/.test(text)
        ? "1日の含まれるルーティン実行数"
        : "Included routine runs per day";
      pushMetric(
        metrics,
        provider,
        label,
        limit > 0 ? (used / limit) * 100 : 0,
        /毎日|daily/i.test(text) ? "Daily" : "毎日",
        `${used} / ${limit}`
      );
    }

    const extra =
      text.match(/追加使用量\s+([^%]{0,220}?)(\d{1,3})\s*%\s*(?:使用|used)/i) ??
      text.match(/extra usage\s+([^%]{0,220}?)(\d{1,3})\s*%\s*(?:used|使用)/i);
    if (extra) pushMetric(metrics, provider, "追加使用量", Number(extra[2]), resetFromSection(extra[1]));

    if (metrics.length > 0) return metrics;
  }

  if (provider === "devin") {
    const dailySection = parseDevinQuotaSection(text, "daily");
    if (dailySection) {
      pushMetric(metrics, provider, "Daily quota", dailySection.usedPercentage, dailySection.resetAt);
    }

    const weeklySection = parseDevinQuotaSection(text, "weekly");
    if (weeklySection) {
      pushMetric(metrics, provider, "Weekly quota", weeklySection.usedPercentage, weeklySection.resetAt);
    }

    const acu =
      text.match(/\b(\d+)\s*\/\s*(\d+)\s+ACUs?\b/i) ??
      text.match(/\b(\d+)\s*\/\s*(\d+)\s+ACU\b/i) ??
      text.match(/\bACUs?\s*[:\s]+\s*(\d+)\s*\/\s*(\d+)/i);
    if (acu && Number(acu[2]) > 0) {
      pushMetric(
        metrics,
        provider,
        "ACU",
        Math.min(100, (Number(acu[1]) / Number(acu[2])) * 100),
        dailySection?.resetAt ?? weeklySection?.resetAt ?? resetAt,
        `${acu[1]} / ${acu[2]}`
      );
    }

    const onDemandBal = text.match(/Remaining\s+balance\s*:?\s*\$?\s*([\-\d.,]+)/i);
    if (onDemandBal && !metrics.some((m) => m.id === "devin-on-demand-balance")) {
      metrics.push({
        id: "devin-on-demand-balance",
        label: "On-demand balance",
        usedPercentage: null,
        detail: `$${onDemandBal[1].replace(/,/g, "")}`,
      });
    }

    const creditsLine =
      text.match(/(?:credits?\s+remaining|残り(?:の)?クレジット)[^\d]{0,24}(\d[\d,.]*)/i) ??
      text.match(/(?:クレジット|残高)[^\d]{0,12}(\d[\d,.]*)/);
    if (creditsLine && !metrics.some((m) => m.id === "devin-credits")) {
      metrics.push({
        id: "devin-credits",
        label: "Credits",
        usedPercentage: null,
        detail: creditsLine[1].replace(/,/g, ""),
      });
    }
    return metrics;
  }

  const candidates = [...document.querySelectorAll("body *")]
    .filter((node) => node.childElementCount <= 3)
    .map((node) => node.innerText?.replace(/\s+/g, " ").trim())
    .filter((value) => Boolean(value) && value.length < 120 && !/[{}[\]<>]/.test(value));

  for (const value of candidates) {
    const percent = value.match(/(\d{1,3})\s*%/);
    if (!percent) continue;
    const usedPercentage = Math.min(100, Number(percent[1]));
    const label =
      value
        .replace(/\d{1,3}\s*%.*/, "")
        .replace(/used|使用済み|利用済み/gi, "")
        .trim() || "Usage";

    pushMetric(metrics, provider, label, usedPercentage, resetAt);
  }

  return metrics.slice(0, 10);
}

function resetFromSection(section) {
  if (!section) return undefined;
  return (
    section.match(/(\d+\s*時間\s*\d+\s*分後にリセット)/)?.[1]?.trim() ??
    section.match(/(\d+\s*時間後にリセット)/)?.[1]?.trim() ??
    section.match(/(\d+\s*分後にリセット)/)?.[1]?.trim() ??
    section.match(/(\d+\s*hours?\s*\d+\s*minutes?\s*later)/i)?.[1]?.trim() ??
    section.match(/(\d+\s*hours?\s*later)/i)?.[1]?.trim() ??
    section.match(/(\d+\s*minutes?\s*later)/i)?.[1]?.trim() ??
    section.match(/(\d{1,2}:\d{2}\s*\([^)]+\)\s*にリセット)/)?.[1]?.trim() ??
    section.match(/([A-Z][a-z]{2}\s+\d{1,2}\s*にリセット)/)?.[1]?.trim() ??
    section.match(/([A-Z][a-z]{2}\s+\d{1,2})/)?.[1]?.trim() ??
    section.match(/([0-9]{4}\/[0-9]{2}\/[0-9]{2}\s+[0-9]{1,2}:[0-9]{2})/)?.[1]?.trim()
  );
}

function codexUsed(value, qualifier) {
  const q = String(qualifier || "").toLowerCase();
  return q === "残り" || q === "remaining" ? 100 - value : value;
}

/** Devin: parse quota block so reset text does not bleed across Daily / Weekly. */
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
    slice.match(/used\s*:?\s*(\d{1,3})\s*%/i) ??
    slice.match(/(?:使用|利用)\s*:?\s*(\d{1,3})\s*%/i);
  if (!pctMatch) return null;

  const resetAt = slice.match(/Resets\s+in\s+(\d+\s+(?:minutes?|hours?|days?))/i)?.[1]?.trim();
  return { usedPercentage: Number(pctMatch[1]), resetAt };
}

function providerName(provider) {
  if (provider === "cursor") return "Cursor";
  if (provider === "codex") return "Codex";
  if (provider === "devin") return "Devin";
  return "Claude";
}

function detachObserver() {
  observer?.disconnect();
  observer = null;
}

function attachObserver() {
  if (observer || !document.body) return;
  observer = new MutationObserver(scheduleSend);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

async function syncCollectorForPage() {
  if (!collectorAlive) return false;
  const provider = await resolveProvider();
  if (!provider) {
    detachObserver();
    return false;
  }
  attachObserver();
  return true;
}

async function sendSnapshot() {
  if (!collectorAlive) return;
  if (!isExtensionContextAlive()) {
    stopCollector("extension context invalidated");
    return;
  }
  const provider = await resolveProvider();
  if (!provider) {
    detachObserver();
    return;
  }
  attachObserver();

  const metrics = metricsFromBars(provider);
  const snapshot = {
    provider,
    name: providerName(provider),
    source: "web-collector",
    url: window.location.href,
    title: document.title,
    collectedAt: new Date().toISOString(),
    metrics,
    status: metrics.length > 0 ? "ok" : "no-metrics",
    diagnostic:
      metrics.length > 0
        ? `${metrics.length} metric(s) extracted from ${document.title}`
        : `Collector ran on ${document.title}, but no metric matched`,
  };

  if (!isExtensionContextAlive()) {
    stopCollector("extension context invalidated");
    return;
  }

  try {
    const result = await chrome.runtime.sendMessage({
      type: "AI_USAGE_SNAPSHOT",
      snapshot,
    });
    if (!result?.ok) {
      console.warn("[AI Usage Monitor] snapshot not saved", result);
      return;
    }
  } catch (error) {
    if (isContextInvalidatedError(error) || !isExtensionContextAlive()) {
      stopCollector("snapshot message rejected: context invalidated");
      return;
    }
    console.warn("[AI Usage Monitor] snapshot send failed", error);
    return;
  }

  if (!isExtensionContextAlive()) {
    stopCollector("extension context invalidated");
    return;
  }

  try {
    await chrome.runtime.sendMessage({
      type: "AI_USAGE_COLLECTED",
      provider,
      metricsCount: metrics.length,
      url: window.location.href,
    });
  } catch (error) {
    if (isContextInvalidatedError(error) || !isExtensionContextAlive()) {
      stopCollector("collected message rejected: context invalidated");
    }
  }
}

let timer = 0;
function scheduleSend() {
  if (!collectorAlive) return;
  if (!isExtensionContextAlive()) {
    stopCollector("extension context invalidated");
    return;
  }
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    void sendSnapshot().catch((error) => {
      if (isContextInvalidatedError(error) || !isExtensionContextAlive()) {
        stopCollector("sendSnapshot rejected: context invalidated");
        return;
      }
      console.warn("[AI Usage Monitor] sendSnapshot failed", error);
    });
  }, 1200);
}

function scheduleDevinRetries() {
  if (!isDevinHost(window.location.hostname) || !isDevinUsagePath(window.location.pathname || "")) return;
  for (const delay of [400, 1200, 3000, 6000]) {
    window.setTimeout(() => scheduleSend(), delay);
  }
}

async function startCollector() {
  if (!document.body) return;
  if (await syncCollectorForPage()) {
    scheduleSend();
    scheduleDevinRetries();
  }
}

function onNavigation() {
  void startCollector();
}

try {
  chrome.runtime?.onMessage?.addListener((message) => {
    if (message?.type === "AI_USAGE_COLLECT_NOW") {
      void startCollector();
    }
  });
} catch (error) {
  if (!isContextInvalidatedError(error)) throw error;
}

try {
  chrome.storage?.onChanged?.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.devinOrgSlug) return;
    void startCollector();
  });
} catch (error) {
  if (!isContextInvalidatedError(error)) throw error;
}
window.addEventListener("popstate", onNavigation);
window.addEventListener("hashchange", onNavigation);

if (document.body) void startCollector();
else document.addEventListener("DOMContentLoaded", () => void startCollector(), { once: true });
