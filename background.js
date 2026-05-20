importScripts("i18n.js");
void initI18n();

const STATIC_USAGE_URLS = [
  "https://cursor.com/dashboard/spending",
  "https://chatgpt.com/codex/cloud/settings/analytics#usage",
  "https://claude.ai/settings/usage",
];

const DEVIN_ORG_SLUG_KEY = "devinOrgSlug";
const POPUP_PROVIDER_PREFS_KEY = "popupProviderPrefs";
const STORE_KEY = "aiUsageStore";

function devinUsagePageUrl(slug) {
  return `https://app.devin.ai/org/${encodeURIComponent(slug)}/settings/usage`;
}

function isDevinAppHost(hostname) {
  return hostname === "app.devin.ai" || hostname.endsWith(".devin.ai");
}

function isDevinUsagePathname(pathname) {
  const p = (pathname || "").replace(/\/+$/, "") || "";
  if (/\/settings\/usage-and-limits$/i.test(p)) return true;
  if (/\/settings\/usage$/i.test(p)) return true;
  if (/\/settings\/[^/]*usage/i.test(p)) return true;
  if (/^\/org\/[^/]+\/usage(?:-and-limits)?$/i.test(p)) return true;
  return false;
}

function isDevinUsagePageUrl(tabUrl) {
  if (!tabUrl) return false;
  try {
    const u = new URL(tabUrl);
    return isDevinAppHost(u.hostname) && isDevinUsagePathname(u.pathname);
  } catch {
    return false;
  }
}

function isValidDevinSlug(slug) {
  return Boolean(slug) && /^[a-zA-Z0-9_-]+$/.test(slug);
}

async function resolveDevinOrgSlug(stored) {
  let slug = String(stored?.[DEVIN_ORG_SLUG_KEY] ?? "").trim();
  if (!slug) {
    slug = devinOrgSlugFromAppUrl(stored?.[STORE_KEY]?.providers?.devin?.url ?? "") ?? "";
  }
  if (!slug) {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      const fromTab = devinOrgSlugFromAppUrl(tab.url ?? "");
      if (fromTab) {
        slug = fromTab;
        break;
      }
    }
  }
  return isValidDevinSlug(slug) ? slug : "";
}

async function getDevinOrgSlug() {
  const stored = await chrome.storage.local.get([DEVIN_ORG_SLUG_KEY, POPUP_PROVIDER_PREFS_KEY, STORE_KEY]);
  const slug = await resolveDevinOrgSlug(stored);
  if (!slug) return "";

  const slugSaved = isValidDevinSlug(String(stored[DEVIN_ORG_SLUG_KEY] ?? "").trim());
  if (slugSaved) return slug;

  if (stored[POPUP_PROVIDER_PREFS_KEY]?.devin?.visible === false) return "";
  return slug;
}

async function getCollectorUrls() {
  const urls = [...STATIC_USAGE_URLS];
  const slug = await getDevinOrgSlug();
  if (slug) urls.push(devinUsagePageUrl(slug));
  return urls;
}

const AUTO_REFRESH_ALARM = "ai-usage-auto-refresh";
const DEFAULT_AUTO_REFRESH_MINUTES = 1;
const MIN_AUTO_REFRESH_MINUTES = 1;
const MAX_AUTO_REFRESH_MINUTES = 120;
const PAUSED_KEY = "aiUsagePaused";
const LEGACY_STORAGE_KEYS = ["dashboardBaseUrl", "dashboardBaseUrls", "ingestToken", "aiUsageLastCommandId"];
const COLLECTOR_SCRIPT_ID = "ai-usage-collector";
const LEGACY_COLLECTOR_SCRIPT_IDS = [COLLECTOR_SCRIPT_ID, "ai-usage-collector-legacy", "content.js"];
const COLLECTOR_MATCHES = [
  "https://cursor.com/*/dashboard/spending*",
  "https://cursor.com/dashboard/spending*",
  "https://chatgpt.com/codex/cloud/settings/analytics*",
  "https://claude.ai/settings/usage*",
  "https://app.devin.ai/*",
];
let latestStore = { updatedAt: null, providers: {} };
const COLLECTOR_VERSION_KEY = "collectorScriptVersion";

function isCollectorTabUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.hostname.includes("cursor.com") && /\/dashboard\/spending/i.test(u.pathname)) return true;
    if (u.hostname.includes("chatgpt.com") && u.href.includes("/codex/")) return true;
    if (u.hostname === "claude.ai" && u.pathname.includes("/settings/usage")) return true;
    if (
      (u.hostname === "app.devin.ai" || u.hostname.endsWith(".devin.ai")) &&
      /\/org\/[^/]+\//.test(u.pathname)
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function registerCollectorContentScript() {
  const registered = await chrome.scripting.getRegisteredContentScripts().catch(() => []);
  const registeredIds = registered.map((entry) => entry.id);
  await chrome.scripting.unregisterContentScripts({ ids: LEGACY_COLLECTOR_SCRIPT_IDS }).catch(() => {});
  if (registeredIds.length > 0) {
    await chrome.scripting.unregisterContentScripts({ ids: registeredIds }).catch(() => {});
  }
  await chrome.scripting.registerContentScripts([
    {
      id: COLLECTOR_SCRIPT_ID,
      js: ["usage-collector.js"],
      matches: COLLECTOR_MATCHES,
      runAt: "document_idle",
    },
  ]);
}

async function reloadCollectorTabsIfVersionChanged() {
  const manifestVersion = chrome.runtime.getManifest().version;
  const stored = await chrome.storage.local.get(COLLECTOR_VERSION_KEY);
  const prev = stored[COLLECTOR_VERSION_KEY];
  if (prev === manifestVersion) return;

  await chrome.storage.local.set({ [COLLECTOR_VERSION_KEY]: manifestVersion });
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.id || !isCollectorTabUrl(tab.url)) continue;
    try {
      await chrome.tabs.reload(tab.id);
    } catch {
      /* ignore */
    }
  }
}

async function onExtensionReady() {
  await chrome.storage.local.remove(LEGACY_STORAGE_KEYS);
  await registerCollectorContentScript().catch(() => {});
  await reloadCollectorTabsIfVersionChanged();
  await initAutoRefreshAlarm();
  await refreshAllUsagePages();
}

chrome.runtime.onInstalled.addListener(() => {
  void onExtensionReady();
});

void getLocalUsageStore()
  .then((store) => {
    latestStore = store;
  })
  .catch(() => {});

chrome.runtime.onStartup.addListener(() => {
  void (async () => {
    await registerCollectorContentScript().catch(() => {});
    void initAutoRefreshAlarm();
    void refreshAllUsagePages();
  })();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.autoRefreshMinutes) return;
  void initAutoRefreshAlarm();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;
  let pathname = "";
  try {
    const u = new URL(tab.url);
    if (u.hostname !== "app.devin.ai" && !u.hostname.endsWith(".devin.ai")) return;
    pathname = u.pathname || "";
    if (!/\/org\/[^/]+\//.test(pathname)) return;
    if (!isDevinUsagePathname(pathname)) return;
  } catch {
    return;
  }
  void chrome.tabs.sendMessage(tabId, { type: "AI_USAGE_COLLECT_NOW" }).catch(() => {});
});

async function getAutoRefreshMinutes() {
  const stored = await chrome.storage.local.get("autoRefreshMinutes");
  const n = Number(stored.autoRefreshMinutes);
  if (!Number.isFinite(n) || n < MIN_AUTO_REFRESH_MINUTES || n > MAX_AUTO_REFRESH_MINUTES) {
    return DEFAULT_AUTO_REFRESH_MINUTES;
  }
  return Math.round(n);
}

function scheduleAutoRefreshAlarm(periodMinutes) {
  chrome.alarms.clear(AUTO_REFRESH_ALARM, () => {
    chrome.alarms.create(AUTO_REFRESH_ALARM, {
      delayInMinutes: 0.05,
      periodInMinutes: periodMinutes,
    });
  });
}

async function initAutoRefreshAlarm() {
  const minutes = await getAutoRefreshMinutes();
  scheduleAutoRefreshAlarm(minutes);
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === AUTO_REFRESH_ALARM) {
    void refreshAllUsagePages();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "AI_USAGE_REFRESH_NOW") {
    void initI18n()
      .then(() => isPaused())
      .then(async (paused) => {
        if (paused) {
          sendResponse({ ok: false, paused: true, error: t("bg_pausedMustResume") });
          return;
        }
        const urls = await getCollectorUrls();
        sendResponse({ ok: true, started: true, urls });
        void refreshAllUsagePages().catch(() => {});
        if (sender.tab?.id) {
          void chrome.tabs.sendMessage(sender.tab.id, {
            type: "AI_USAGE_REFRESH_STARTED",
            urls,
          });
        }
      })
      .catch(() => {
        sendResponse({ ok: false, error: t("bg_errRefreshStart") });
      });
    return true;
  }

  if (message?.type === "AI_USAGE_GET_PAUSED") {
    void isPaused()
      .then((paused) => sendResponse({ ok: true, paused }))
      .catch(() => sendResponse({ ok: false, paused: false }));
    return true;
  }

  if (message?.type === "AI_USAGE_SET_PAUSED") {
    void setPaused(Boolean(message.paused))
      .then((paused) => sendResponse({ ok: true, paused }))
      .catch(() => sendResponse({ ok: false, error: t("bg_errPauseSave") }));
    return true;
  }

  if (message?.type === "AI_USAGE_GET_STORE") {
    void getLocalUsageStore()
      .then((store) => {
        latestStore = store;
        sendResponse({ ok: true, store });
      })
      .catch(() => sendResponse({ ok: false, store: latestStore }));
    return true;
  }

  if (message?.type === "AI_USAGE_SNAPSHOT") {
    saveLocalSnapshot(message.snapshot)
      .then(() => sendResponse({ ok: true, accepted: true }))
      .catch(() => sendResponse({ ok: false, accepted: false }));
    return true;
  }
});

async function getLocalUsageStore() {
  const stored = await chrome.storage.local.get(STORE_KEY);
  return stored[STORE_KEY] ?? { updatedAt: null, providers: {} };
}

async function saveLocalSnapshot(snapshot) {
  if (!snapshot?.provider) return getLocalUsageStore();
  const current = await getLocalUsageStore();
  const next = {
    updatedAt: new Date().toISOString(),
    providers: {
      ...(current.providers ?? {}),
      [snapshot.provider]: snapshot,
    },
  };
  await chrome.storage.local.set({ [STORE_KEY]: next });
  latestStore = next;
  return next;
}

async function refreshAllUsagePages() {
  if (await isPaused()) return false;
  const urls = await getCollectorUrls();
  for (const url of urls) {
    await openOrFocusCollectorTab(url);
  }
  return true;
}

async function isPaused() {
  const stored = await chrome.storage.local.get(PAUSED_KEY);
  return Boolean(stored[PAUSED_KEY]);
}

async function setPaused(paused) {
  await chrome.storage.local.set({ [PAUSED_KEY]: paused });
  return paused;
}

async function openOrFocusCollectorTab(url) {
  const baseNoHash = url.split("#")[0];
  let matching;

  if (isCursorUsageCollectorUrl(baseNoHash)) {
    const cursorTabs = await chrome.tabs.query({ url: "https://cursor.com/*" });
    matching = cursorTabs.find((tab) => isCursorSpendingPageUrl(tab.url));
  } else if (devinOrgSlugFromAppUrl(baseNoHash)) {
    await openOrFocusDevinCollectorTab(baseNoHash);
    return;
  } else {
    const existing = await chrome.tabs.query({ url: `${originPattern(url)}/*` });
    matching = existing.find((tab) => tab.url?.startsWith(baseNoHash));
  }

  if (matching?.id) {
    await chrome.tabs.reload(matching.id);
    return;
  }

  let tab;
  try {
    tab = await chrome.tabs.create({ url, active: false });
  } catch (error) {
    const message = String(error);
    if (!message.includes("No current window")) throw error;

    const normalWindows = await chrome.windows.getAll({ populate: false, windowTypes: ["normal"] }).catch(() => []);

    if (normalWindows.length === 0) {
      const createdWindow = await chrome.windows.create({ url, focused: false });
      tab = createdWindow.tabs?.[0];
    } else {
      tab = await chrome.tabs.create({ url, active: false, windowId: normalWindows[0].id });
    }
  }
}

/** pathname が .../dashboard/spending（任意のロケールセグメント付き可） */
function isCursorSpendingPathname(pathname) {
  const p = (pathname || "").replace(/\/+$/, "") || "";
  return /^(\/[a-z]{2}(?:-[A-Z]{2})?)?\/dashboard\/spending$/i.test(p);
}

/** manifest の Cursor 収集 URL と一致するか */
function isCursorUsageCollectorUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname === "cursor.com" && isCursorSpendingPathname(u.pathname);
  } catch {
    return false;
  }
}

/** 既存タブが Cursor の使用量（spending）ページか */
function isCursorSpendingPageUrl(tabUrl) {
  if (!tabUrl) return false;
  try {
    const u = new URL(tabUrl);
    return u.hostname === "cursor.com" && isCursorSpendingPathname(u.pathname);
  } catch {
    return false;
  }
}

function originPattern(url) {
  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname.replace(/\/[^/]*$/, "")}`;
}

async function openOrFocusDevinCollectorTab(targetUrl) {
  const slug = devinOrgSlugFromAppUrl(targetUrl);
  if (!slug) return;

  const allTabs = await chrome.tabs.query({});
  const orgTabs = allTabs.filter((tab) => devinOrgSlugFromAppUrl(tab.url ?? "") === slug);
  const usageTab = orgTabs.find((tab) => isDevinUsagePageUrl(tab.url));

  if (usageTab?.id) {
    await chrome.tabs.reload(usageTab.id);
    return;
  }

  if (orgTabs[0]?.id) {
    await chrome.tabs.update(orgTabs[0].id, { url: targetUrl, active: false });
    return;
  }

  try {
    await chrome.tabs.create({ url: targetUrl, active: false });
  } catch (error) {
    const message = String(error);
    if (!message.includes("No current window")) throw error;

    const normalWindows = await chrome.windows.getAll({ populate: false, windowTypes: ["normal"] }).catch(() => []);
    if (normalWindows.length === 0) {
      await chrome.windows.create({ url: targetUrl, focused: false });
    } else {
      await chrome.tabs.create({ url: targetUrl, active: false, windowId: normalWindows[0].id });
    }
  }
}

function devinOrgSlugFromAppUrl(tabUrl) {
  if (!tabUrl) return null;
  try {
    const u = new URL(tabUrl);
    if (!isDevinAppHost(u.hostname)) return null;
    const m = u.pathname.match(/^\/org\/([^/]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}
