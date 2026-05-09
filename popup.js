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
};
const PROVIDER_UI = {
  cursor: { icon: "➤", className: "provider-cursor" },
  codex: { icon: "&lt;/&gt;", className: "provider-codex" },
  claude: { icon: "✶", className: "provider-claude" },
};
let paused = false;

function formatDateTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("ja-JP", {
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

/** リセット表示を MM/DD HH:mm に統一（例: 05/09 17:09） */
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

  value = value.replace(/^リセット[:：]\s*/i, "").replace(/\s*にリセット$/i, "").trim();
  if (!value) return "";

  if (/毎日/.test(value)) return "毎日";

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

  const hourMinuteAfter = value.match(/(\d+)\s*時間\s*(\d+)\s*分後/);
  if (hourMinuteAfter) {
    const date = new Date(Date.now() + Number(hourMinuteAfter[1]) * 3600000 + Number(hourMinuteAfter[2]) * 60000);
    return formatResetDateTime(date);
  }
  const hourAfter = value.match(/(\d+)\s*時間後/);
  if (hourAfter) {
    const date = new Date(Date.now() + Number(hourAfter[1]) * 3600000);
    return formatResetDateTime(date);
  }
  const minuteAfter = value.match(/(\d+)\s*分後/);
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

  const daysAfter = value.match(/^(\d+)\s*日後/);
  if (daysAfter) {
    const date = new Date(Date.now() + Number(daysAfter[1]) * 86400000);
    date.setHours(0, 0, 0, 0);
    return formatResetDateTime(date);
  }

  const timeOnly = value.match(/^(\d{1,2}):(\d{2})$/);
  if (timeOnly) {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(timeOnly[1]), Number(timeOnly[2]), 0, 0);
    return formatResetDateTime(date);
  }

  const already = value.match(/^(\d{2})\/(\d{2})\s+(\d{1,2}):(\d{2})$/);
  if (already) {
    return `${already[1]}/${already[2]} ${String(Number(already[3])).padStart(2, "0")}:${already[4]}`;
  }

  return value;
}

function metricRow(metric) {
  const percentage =
    typeof metric.usedPercentage === "number"
      ? Math.max(0, Math.min(100, metric.usedPercentage))
      : null;
  const rightText = percentage === null ? (metric.detail || "-") : `${percentage}%`;
  const resetMeta = metric.resetAt ? `リセット: ${normalizeResetValue(metric.resetAt)}` : "";
  const rawDetail = metric.resetAt ? "" : metric.detail || "";
  const detail = percentage === null && String(rawDetail) === String(rightText) ? "" : rawDetail;

  return `
    <div class="metric">
      <div class="line">
        <span class="line-main">
          <span>${escapeHtml(metric.label || "Usage")}</span>
          ${resetMeta ? `<span class="line-sub">${escapeHtml(resetMeta)}</span>` : ""}
        </span>
        <strong>${escapeHtml(rightText)}</strong>
      </div>
      ${percentage === null ? "" : `<div class="bar"><span style="width:${percentage}%"></span></div>`}
      ${detail ? `<div class="meta">${escapeHtml(detail)}</div>` : ""}
    </div>
  `;
}

function providerCard(providerKey, snapshot) {
  const providerName = snapshot?.name || providerKey;
  const metrics = Array.isArray(snapshot?.metrics) ? snapshot.metrics : [];
  const providerUi = PROVIDER_UI[providerKey] ?? { icon: "•", className: "provider-default" };
  const body =
    metrics.length > 0
      ? metrics.map(metricRow).join("")
      : '<div class="meta">まだメトリクスがありません。</div>';

  return `
    <article class="provider ${providerUi.className}">
      <h2><span class="provider-icon">${providerUi.icon}</span><span>${escapeHtml(providerName)}</span></h2>
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
  if (!value) return true;
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
  updatedAtEl.textContent = `最終更新: ${formatDateTime(store?.updatedAt)}`;

  if (entries.length === 0) {
    providersEl.innerHTML = '<div class="empty">表示対象のデータがありません。設定で表示対象を確認してください。</div>';
    return;
  }

  providersEl.innerHTML = entries
    .map(([providerKey, snapshot]) => providerCard(providerKey, snapshot))
    .join("");
}

async function loadPopupPrefs() {
  const stored = await chrome.storage.local.get(["popupProviderPrefs"]);
  return { ...DEFAULT_PROVIDER_PREFS, ...(stored.popupProviderPrefs ?? {}) };
}

async function loadStore() {
  const popupPrefs = await loadPopupPrefs();
  const response = await chrome.runtime.sendMessage({ type: "AI_USAGE_GET_STORE" }).catch((error) => {
    if (String(error?.message || error).includes("Extension context invalidated")) {
      throw new Error("拡張が更新されました。拡張を再読み込みしてください。");
    }
    throw error;
  });
  if (!response?.ok) {
    throw new Error(response?.error || "ストア取得に失敗しました");
  }
  renderStore(response.store, popupPrefs);
}

function applyPausedUI() {
  refreshButton.disabled = paused;
  togglePauseButton.textContent = paused ? "再開" : "停止";
  togglePauseButton.classList.toggle("is-paused", paused);
  statusEl.classList.toggle("is-paused", paused);
  modeStateEl.classList.toggle("is-paused", paused);
  modeStateEl.classList.toggle("is-running", !paused);
  modeStateEl.textContent = paused ? "更新停止中" : "稼働中";
  if (paused) {
    statusEl.textContent = "更新停止中です。再開すると巡回を再開できます。";
  } else if (statusEl.textContent.includes("更新停止中")) {
    statusEl.textContent = "";
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
    throw new Error(response?.error || "停止状態の更新に失敗しました");
  }
  paused = Boolean(response.paused);
  applyPausedUI();
}

async function refreshNow() {
  if (paused) {
    statusEl.classList.add("is-paused");
    statusEl.textContent = "更新停止中です。再開してから実行してください。";
    return;
  }
  statusEl.classList.remove("is-paused");
  refreshButton.disabled = true;
  statusEl.textContent = "更新しています。数秒後に再読み込みします...";
  try {
    const result = await chrome.runtime.sendMessage({ type: "AI_USAGE_REFRESH_NOW" });
    if (!result?.ok) throw new Error(result?.error || "更新開始に失敗しました");
    window.setTimeout(() => {
      void loadStore().catch((error) => {
        statusEl.textContent = `更新に失敗: ${error.message}`;
      });
    }, 2500);
  } catch (error) {
    statusEl.textContent = `エラー: ${error.message}`;
  } finally {
    window.setTimeout(() => {
      refreshButton.disabled = paused;
      if (statusEl.textContent.startsWith("更新")) statusEl.textContent = "";
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
    statusEl.textContent = `エラー: ${error.message}`;
  });
});

void Promise.all([loadPausedState(), loadStore()]).catch((error) => {
  statusEl.classList.remove("is-paused");
  statusEl.textContent = `読み込みに失敗: ${error.message}`;
});
