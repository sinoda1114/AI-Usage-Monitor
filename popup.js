const providersEl = document.getElementById("providers");
const statusEl = document.getElementById("status");
const updatedAtEl = document.getElementById("updatedAt");
const modeStateEl = document.getElementById("modeState");
const refreshButton = document.getElementById("refreshNow");
const togglePauseButton = document.getElementById("togglePause");
const openOptionsButton = document.getElementById("openOptions");
const DEFAULT_PROVIDER_PREFS = {
  cursor: { visible: true, order: 1 },
  codex: { visible: true, order: 2 },
  claude: { visible: true, order: 3 },
  devin: { visible: false, order: 4 },
};
const DEVIN_HEXAGON_ICON =
  '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" ' +
  'd="M12 5 18.062 8.5 18.062 15.5 12 19 5.938 15.5 5.938 8.5z"/></svg>';

const PROVIDER_UI = {
  cursor: { icon: "➤", className: "provider-cursor" },
  codex: { icon: "&lt;/&gt;", className: "provider-codex" },
  claude: { icon: "✶", className: "provider-claude" },
  devin: { icon: DEVIN_HEXAGON_ICON, className: "provider-devin", iconKind: "svg" },
};

/** スクレイプ原文（日本語/英語）→ 翻訳キー */
const METRIC_LABEL_TO_KEY = {
  "5時間の使用制限": "metric_codex_five_hour",
  "週あたりの使用制限": "metric_codex_weekly",
  "残りのクレジット": "metric_codex_credits",
  "現在のセッション": "metric_claude_current_session",
  "週間制限": "metric_claude_weekly",
  "Claude Design": "metric_claude_design",
  "1日の含まれるルーティン実行数": "metric_claude_routines",
  "追加使用量": "metric_claude_extra",
  "5-hour usage limit": "metric_codex_five_hour",
  "Weekly usage limit": "metric_codex_weekly",
  "Credits remaining": "metric_codex_credits",
  "ACU": "metric_devin_acu",
  "Credits": "metric_devin_credits",
  "Included routine runs per day": "metric_claude_routines",
  "extra usage": "metric_claude_extra",
  "Extra usage": "metric_claude_extra",
  "Total": "metric_cursor_total",
  "Auto + Composer": "metric_cursor_auto_composer",
  "API": "metric_cursor_api",
  "Daily quota": "metric_devin_daily_quota",
  "Weekly quota": "metric_devin_weekly_quota",
  "On-demand balance": "metric_devin_on_demand_balance",
};

function metricIdToMessageKey(id) {
  if (!id) return null;
  return `metric_${String(id).replace(/-/g, "_")}`;
}

function translateMetricLabel(metric) {
  const idKey = metricIdToMessageKey(metric?.id);
  if (idKey) {
    const fromId = t(idKey);
    if (fromId && fromId !== idKey) return fromId;
  }
  const raw = String(metric?.label ?? "").trim();
  if (!raw) return t("metric_usage");
  const aliasKey = METRIC_LABEL_TO_KEY[raw];
  if (aliasKey) {
    const tr = t(aliasKey);
    if (tr && tr !== aliasKey) return tr;
  }
  return raw;
}
let paused = false;
let statusKind = "";

const pauseIcon = togglePauseButton.querySelector(".icon-pause");
const playIcon = togglePauseButton.querySelector(".icon-play");

function applyActionLabels() {
  for (const button of [refreshButton, togglePauseButton, openOptionsButton]) {
    const key = button.getAttribute("data-label-key");
    if (!key) continue;
    const label = t(key);
    button.title = label;
    button.setAttribute("aria-label", label);
  }
  updatePauseActionLabel();
}

function updatePauseActionLabel() {
  const key = paused ? "popup_resume" : "popup_pause";
  togglePauseButton.setAttribute("data-label-key", key);
  const label = t(key);
  togglePauseButton.title = label;
  togglePauseButton.setAttribute("aria-label", label);
}

function formatDateTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat(uiLocale(), {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatResetDateTime(date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${m}/${d} ${h}:${min}`;
}

function normalizeResetValue(rawValue) {
  let value = String(rawValue || "").trim();
  if (!value) return "";

  value = value
    .replace(/^(?:reset|リセット)[:：]\s*/i, "")
    .replace(/\s*(?:にリセット|に reset)$/i, "")
    .trim();
  if (!value) return "";

  if (/トライアル|trial|ご利用いただ|無料トライアル/i.test(value)) return "";

  const jaMonthDay = value.match(/^(\d{1,2})\s*月\s*(\d{1,2})\s*日(?:\s*\(\s*(\d+)\s*days?\s*\))?/i);
  if (jaMonthDay) {
    const now = new Date();
    const mo = Number(jaMonthDay[1]) - 1;
    const day = Number(jaMonthDay[2]);
    let candidate = new Date(now.getFullYear(), mo, day, 0, 0, 0, 0);
    if (candidate < now) candidate = new Date(now.getFullYear() + 1, mo, day, 0, 0, 0, 0);
    return formatResetDateTime(candidate);
  }

  if (/毎日|daily/i.test(value)) return t("popup_resetDaily");

  const fullDate = value.match(/^(\d{4})\/(\d{2})\/(\d{2})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (fullDate) {
    const y = Number(fullDate[1]);
    const mo = Number(fullDate[2]) - 1;
    const day = Number(fullDate[3]);
    const hh = fullDate[4] != null ? Number(fullDate[4]) : 0;
    const mm = fullDate[5] != null ? Number(fullDate[5]) : 0;
    return formatResetDateTime(new Date(y, mo, day, hh, mm, 0, 0));
  }

  const shortDate = value.match(/^(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (shortDate) {
    const now = new Date();
    const mo = Number(shortDate[1]) - 1;
    const day = Number(shortDate[2]);
    const hh = shortDate[3] != null ? Number(shortDate[3]) : 0;
    const mm = shortDate[4] != null ? Number(shortDate[4]) : 0;
    let candidate = new Date(now.getFullYear(), mo, day, hh, mm, 0, 0);
    if (candidate < now && shortDate[3] == null) {
      candidate = new Date(now.getFullYear() + 1, mo, day, hh, mm, 0, 0);
    }
    return formatResetDateTime(candidate);
  }

  const monthMap = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12",
  };
  const englishDate = value.match(/^([A-Za-z]{3})\s+(\d{1,2})$/i);
  if (englishDate) {
    const monthNum = monthMap[englishDate[1].toLowerCase()];
    if (monthNum) {
      const now = new Date();
      const mo = Number(monthNum) - 1;
      const day = Number(englishDate[2]);
      let candidate = new Date(now.getFullYear(), mo, day, 0, 0, 0, 0);
      if (candidate < now) candidate = new Date(now.getFullYear() + 1, mo, day, 0, 0, 0, 0);
      return formatResetDateTime(candidate);
    }
  }

  const hourMinuteAfter =
    value.match(/(\d+)\s*時間\s*(\d+)\s*分後/) ??
    value.match(/(\d+)\s*hours?\s*(\d+)\s*minutes?(?:\s*later)?$/i);
  if (hourMinuteAfter) {
    const date = new Date(
      Date.now() + Number(hourMinuteAfter[1]) * 3600000 + Number(hourMinuteAfter[2]) * 60000
    );
    return formatResetDateTime(date);
  }
  const hourAfter = value.match(/(\d+)\s*時間後/) ?? value.match(/(\d+)\s*hours?(?:\s*later)?$/i);
  if (hourAfter) {
    const date = new Date(Date.now() + Number(hourAfter[1]) * 3600000);
    return formatResetDateTime(date);
  }
  const minuteAfter = value.match(/(\d+)\s*分後/) ?? value.match(/(\d+)\s*minutes?(?:\s*later)?$/i);
  if (minuteAfter) {
    const date = new Date(Date.now() + Number(minuteAfter[1]) * 60000);
    return formatResetDateTime(date);
  }

  const dayOnlyJa = value.match(/^(\d{1,2})日$/);
  if (dayOnlyJa) {
    const dayNum = Number(dayOnlyJa[1]);
    const now = new Date();
    let candidate = new Date(now.getFullYear(), now.getMonth(), dayNum, 0, 0, 0, 0);
    if (candidate < now) candidate = new Date(now.getFullYear(), now.getMonth() + 1, dayNum, 0, 0, 0, 0);
    return formatResetDateTime(candidate);
  }

  const daysAfter = value.match(/^(\d+)\s*日後/) ?? value.match(/^(\d+)\s*days?(?:\s*later)?$/i);
  if (daysAfter) {
    const date = new Date(Date.now() + Number(daysAfter[1]) * 86400000);
    date.setHours(0, 0, 0, 0);
    return formatResetDateTime(date);
  }

  const timeOnly = value.match(/^(\d{1,2}):(\d{2})$/);
  if (timeOnly) {
    const now = new Date();
    const date = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      Number(timeOnly[1]),
      Number(timeOnly[2]),
      0,
      0
    );
    return formatResetDateTime(date);
  }

  const already = value.match(/^(\d{2})\/(\d{2})\s+(\d{1,2}):(\d{2})$/);
  if (already) {
    return `${already[1]}/${already[2]} ${String(Number(already[3])).padStart(2, "0")}:${already[4]}`;
  }

  return value;
}

function setStatus(kind, detail) {
  statusKind = kind || "";
  if (kind === "paused") {
    statusEl.textContent = t("popup_pausedHint");
    return;
  }
  if (kind === "refreshing") {
    statusEl.textContent = t("popup_refreshing");
    return;
  }
  if (kind === "paused-must-resume") {
    statusEl.textContent = t("popup_pausedMustResume");
    return;
  }
  if (kind === "error") {
    statusEl.textContent = t("popup_errGeneric", detail);
    return;
  }
  if (kind === "refresh-error") {
    statusEl.textContent = t("popup_errRefresh", detail);
    return;
  }
  if (kind === "load-error") {
    statusEl.textContent = t("popup_errLoad", detail);
    return;
  }
  statusEl.textContent = detail || "";
}

function metricRow(metric) {
  const percentage =
    typeof metric.usedPercentage === "number"
      ? Math.max(0, Math.min(100, metric.usedPercentage))
      : null;
  const rightText = percentage === null ? metric.detail || "-" : `${percentage}%`;
  const resetMeta = metric.resetAt
    ? `${t("popup_resetPrefix")} ${normalizeResetValue(metric.resetAt)}`
    : "";
  const rawDetail = metric.resetAt ? "" : metric.detail || "";
  const detail = percentage === null && String(rawDetail) === String(rightText) ? "" : rawDetail;

  return `
    <div class="metric">
      <div class="line">
        <span class="line-main">
          <span>${escapeHtml(translateMetricLabel(metric))}</span>
          ${resetMeta ? `<span class="line-sub">${escapeHtml(resetMeta)}</span>` : ""}
        </span>
        <strong>${escapeHtml(rightText)}</strong>
      </div>
      ${percentage === null ? "" : `<div class="bar"><span style="width:${percentage}%"></span></div>`}
      ${detail ? `<div class="meta">${escapeHtml(detail)}</div>` : ""}
    </div>
  `;
}

function providerIconMarkup(providerUi) {
  const iconClass =
    providerUi.iconKind === "svg" ? "provider-icon provider-icon--devin" : "provider-icon";
  return `<span class="${iconClass}" aria-hidden="true">${providerUi.icon}</span>`;
}

function providerCard(providerKey, snapshot) {
  const providerName = snapshot?.name || providerKey;
  const metrics = Array.isArray(snapshot?.metrics) ? snapshot.metrics : [];
  const providerUi = PROVIDER_UI[providerKey] ?? { icon: "•", className: "provider-default" };
  const body =
    metrics.length > 0
      ? metrics.map(metricRow).join("")
      : `<div class="meta">${escapeHtml(t("popup_noMetrics"))}</div>`;

  return `
    <article class="provider ${providerUi.className}">
      <h2>${providerIconMarkup(providerUi)}<span>${escapeHtml(providerName)}</span></h2>
      ${body}
    </article>
  `;
}

function toProviderOrderValue(providerKey, prefs) {
  const order = Number(prefs?.[providerKey]?.order);
  if (Number.isFinite(order) && order > 0) return order;
  return 999;
}

function isProviderVisible(providerKey, prefs) {
  const value = prefs?.[providerKey];
  if (!value) return false;
  return value.visible !== false;
}

function renderStore(store, providerPrefs) {
  const providers = store?.providers ?? {};
  const entries = Object.entries(providers)
    .filter(([providerKey]) => isProviderVisible(providerKey, providerPrefs))
    .sort(([a], [b]) => {
      const orderDiff = toProviderOrderValue(a, providerPrefs) - toProviderOrderValue(b, providerPrefs);
      return orderDiff !== 0 ? orderDiff : a.localeCompare(b);
    });
  updatedAtEl.textContent = t("popup_lastUpdated", formatDateTime(store?.updatedAt));

  if (entries.length === 0) {
    providersEl.innerHTML = `<div class="empty">${escapeHtml(t("popup_emptyStore"))}</div>`;
    return;
  }

  providersEl.innerHTML = entries
    .map(([providerKey, snapshot]) => providerCard(providerKey, snapshot))
    .join("");
}

function mergePopupProviderPrefs(raw) {
  const merged = {};
  for (const key of Object.keys(DEFAULT_PROVIDER_PREFS)) {
    const layer = raw?.[key];
    const patch = layer && typeof layer === "object" ? layer : {};
    merged[key] = {
      ...DEFAULT_PROVIDER_PREFS[key],
      ...patch,
    };
    if (typeof merged[key].visible !== "boolean") {
      merged[key].visible = DEFAULT_PROVIDER_PREFS[key].visible;
    }
    const ord = merged[key].order;
    if (typeof ord !== "number" || !Number.isFinite(ord)) {
      merged[key].order = DEFAULT_PROVIDER_PREFS[key].order;
    }
  }
  return merged;
}

async function loadPopupPrefs() {
  const stored = await chrome.storage.local.get(["popupProviderPrefs"]);
  return mergePopupProviderPrefs(stored.popupProviderPrefs);
}

async function loadStore() {
  const popupPrefs = await loadPopupPrefs();
  const response = await chrome.runtime.sendMessage({ type: "AI_USAGE_GET_STORE" }).catch((error) => {
    if (String(error?.message || error).includes("Extension context invalidated")) {
      throw new Error(t("popup_errContextInvalidated"));
    }
    throw error;
  });
  if (!response?.ok) {
    throw new Error(response?.error || t("popup_errStoreFailed"));
  }
  renderStore(response.store, popupPrefs);
}

function applyPausedUI() {
  refreshButton.disabled = paused;
  pauseIcon?.toggleAttribute("hidden", paused);
  playIcon?.toggleAttribute("hidden", !paused);
  updatePauseActionLabel();
  togglePauseButton.classList.toggle("is-paused", paused);
  statusEl.classList.toggle("is-paused", paused);
  modeStateEl.classList.toggle("is-paused", paused);
  modeStateEl.classList.toggle("is-running", !paused);
  modeStateEl.textContent = paused ? t("popup_modePaused") : t("popup_modeRunning");
  if (paused) {
    setStatus("paused");
  } else if (statusKind === "paused" || statusKind === "paused-must-resume") {
    setStatus("");
  }
}

async function loadPausedState() {
  const response = await chrome.runtime.sendMessage({ type: "AI_USAGE_GET_PAUSED" });
  paused = Boolean(response?.paused);
  applyPausedUI();
}

async function togglePausedState() {
  const response = await chrome.runtime.sendMessage({ type: "AI_USAGE_SET_PAUSED", paused: !paused });
  if (!response?.ok) {
    throw new Error(response?.error || t("popup_errPauseFailed"));
  }
  paused = Boolean(response.paused);
  applyPausedUI();
}

async function refreshNow() {
  if (paused) {
    statusEl.classList.add("is-paused");
    setStatus("paused-must-resume");
    return;
  }
  statusEl.classList.remove("is-paused");
  refreshButton.disabled = true;
  setStatus("refreshing");
  try {
    const result = await chrome.runtime.sendMessage({ type: "AI_USAGE_REFRESH_NOW" });
    if (!result?.ok) throw new Error(result?.error || t("popup_errRefreshStart"));
    window.setTimeout(() => {
      void loadStore().catch((error) => {
        setStatus("refresh-error", error.message);
      });
    }, 2500);
  } catch (error) {
    setStatus("error", error.message);
  } finally {
    window.setTimeout(() => {
      refreshButton.disabled = paused;
      if (statusKind === "refreshing") setStatus("");
    }, 1200);
  }
}

refreshButton.addEventListener("click", () => {
  void refreshNow();
});

openOptionsButton.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

togglePauseButton.addEventListener("click", () => {
  void togglePausedState().catch((error) => {
    statusEl.classList.remove("is-paused");
    setStatus("error", error.message);
  });
});

async function boot() {
  await initI18n();
  applyI18n();
  applyActionLabels();
  await Promise.all([loadPausedState(), loadStore()]).catch((error) => {
    statusEl.classList.remove("is-paused");
    setStatus("load-error", error.message);
  });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.aiUsageStore) return;
  void loadStore().catch((error) => {
    setStatus("load-error", error.message);
  });
});

void boot();

