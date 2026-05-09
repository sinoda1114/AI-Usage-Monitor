const USAGE_URLS = [
  "https://cursor.com/ja/dashboard/spending",
  "https://chatgpt.com/codex/cloud/settings/analytics#usage",
  "https://claude.ai/settings/usage",
];

const AUTO_REFRESH_ALARM = "ai-usage-auto-refresh";
const AUTO_REFRESH_MINUTES = 1;
const OPENED_TAB_KEY = "aiUsageOpenedTabs";
const STORE_KEY = "aiUsageStore";
const PAUSED_KEY = "aiUsagePaused";
const LEGACY_STORAGE_KEYS = ["dashboardBaseUrl", "dashboardBaseUrls", "ingestToken", "aiUsageLastCommandId"];
let latestStore = { updatedAt: null, providers: {} };

chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.local.remove(LEGACY_STORAGE_KEYS);
  chrome.alarms.create(AUTO_REFRESH_ALARM, {
    delayInMinutes: 0.05,
    periodInMinutes: AUTO_REFRESH_MINUTES,
  });
  void refreshAllUsagePages();
});

void getLocalUsageStore()
  .then((store) => {
    latestStore = store;
  })
  .catch(() => {});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(AUTO_REFRESH_ALARM, {
    delayInMinutes: 0.05,
    periodInMinutes: AUTO_REFRESH_MINUTES,
  });
  void refreshAllUsagePages();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === AUTO_REFRESH_ALARM) {
    void refreshAllUsagePages();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "AI_USAGE_REFRESH_NOW") {
    void isPaused()
      .then((paused) => {
        if (paused) {
          sendResponse({ ok: false, paused: true, error: "更新停止中です。再開してから実行してください。" });
          return;
        }
        sendResponse({ ok: true, started: true, urls: USAGE_URLS });
        void refreshAllUsagePages().catch(() => {});
        if (sender.tab?.id) {
          void chrome.tabs.sendMessage(sender.tab.id, {
            type: "AI_USAGE_REFRESH_STARTED",
            urls: USAGE_URLS,
          });
        }
      })
      .catch(() => {
        sendResponse({ ok: false, error: "更新開始に失敗しました" });
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
      .catch(() => sendResponse({ ok: false, error: "更新状態の保存に失敗しました" }));
    return true;
  }

  if (message?.type === "AI_USAGE_GET_STORE") {
    sendResponse({ ok: true, store: latestStore });
    return;
  }

  if (message?.type === "AI_USAGE_SNAPSHOT") {
    sendResponse({ ok: true, accepted: true });
    void saveLocalSnapshot(message.snapshot).catch(() => {});
    return;
  }

  if (message?.type !== "AI_USAGE_COLLECTED" || !sender.tab?.id) return;
  void closeIfCollectorOpened(sender.tab.id);
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
  for (const url of USAGE_URLS) {
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
  const existing = await chrome.tabs.query({ url: `${originPattern(url)}/*` });
  const matching = existing.find((tab) => tab.url?.startsWith(url.split("#")[0]));
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
  if (tab.id) await rememberOpenedTab(tab.id);

  setTimeout(() => {
    if (tab.id) void closeIfCollectorOpened(tab.id);
  }, 30000);
}

function originPattern(url) {
  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname.replace(/\/[^/]*$/, "")}`;
}

async function rememberOpenedTab(tabId) {
  const stored = await chrome.storage.session.get(OPENED_TAB_KEY);
  const ids = new Set(stored[OPENED_TAB_KEY] ?? []);
  ids.add(tabId);
  await chrome.storage.session.set({ [OPENED_TAB_KEY]: [...ids] });
}

async function closeIfCollectorOpened(tabId) {
  const stored = await chrome.storage.session.get(OPENED_TAB_KEY);
  const ids = new Set(stored[OPENED_TAB_KEY] ?? []);
  if (!ids.has(tabId)) return;

  ids.delete(tabId);
  await chrome.storage.session.set({ [OPENED_TAB_KEY]: [...ids] });

  await chrome.tabs.remove(tabId).catch(() => {});
}
