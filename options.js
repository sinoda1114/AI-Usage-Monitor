const statusEl = document.getElementById("status");
const saveButton = document.getElementById("save");
const providerOrderList = document.getElementById("providerOrderList");
const autoRefreshSelect = document.getElementById("autoRefreshMinutes");

const PROVIDER_LABELS = {
  cursor: "Cursor",
  codex: "Codex",
  claude: "Claude",
};

const DEFAULT_PREFS = {
  cursor: { visible: true, order: 1 },
  codex: { visible: true, order: 2 },
  claude: { visible: true, order: 3 },
};

const AUTO_REFRESH_OPTIONS = [1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120];
const DEFAULT_AUTO_REFRESH_MINUTES = 1;

const LEGACY_STORAGE_KEYS = ["dashboardBaseUrl", "dashboardBaseUrls", "ingestToken", "aiUsageLastCommandId"];

function rowByProvider(provider) {
  return providerOrderList.querySelector(`[data-provider="${provider}"]`);
}

function readProviderPrefs() {
  const rows = [...providerOrderList.querySelectorAll(".provider-order-row")];
  const result = {};
  rows.forEach((row, index) => {
    const key = row.dataset.provider;
    const checkbox = row.querySelector('input[type="checkbox"]');
    result[key] = {
      visible: Boolean(checkbox?.checked),
      order: index + 1,
    };
  });
  return result;
}

function applyProviderPrefs(prefs) {
  const keys = Object.keys(DEFAULT_PREFS).sort((a, b) => {
    const orderA = prefs?.[a]?.order ?? DEFAULT_PREFS[a].order;
    const orderB = prefs?.[b]?.order ?? DEFAULT_PREFS[b].order;
    return orderA - orderB;
  });
  const byKey = {};
  for (const k of keys) {
    byKey[k] = rowByProvider(k);
  }
  for (const k of keys) {
    const row = byKey[k];
    if (!row) continue;
    providerOrderList.appendChild(row);
    const v = prefs?.[k] ?? DEFAULT_PREFS[k];
    const checkbox = row.querySelector('input[type="checkbox"]');
    if (checkbox) checkbox.checked = v.visible !== false;
  }
}

function fillAutoRefreshSelect() {
  autoRefreshSelect.innerHTML = "";
  for (const m of AUTO_REFRESH_OPTIONS) {
    const opt = document.createElement("option");
    opt.value = String(m);
    opt.textContent = `${m} 分`;
    autoRefreshSelect.appendChild(opt);
  }
}

function getDragAfterElement(container, y) {
  const rows = [...container.querySelectorAll(".provider-order-row:not(.dragging)")];
  return rows.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: undefined }
  ).element;
}

let draggedRow = null;

function setupDragAndDrop() {
  providerOrderList.addEventListener("dragstart", (e) => {
    if (e.target.closest('input[type="checkbox"]')) {
      e.preventDefault();
      return;
    }
    const row = e.target.closest(".provider-order-row");
    if (!row || !providerOrderList.contains(row)) return;
    draggedRow = row;
    row.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", row.dataset.provider || "");
  });

  providerOrderList.addEventListener("dragend", () => {
    if (draggedRow) draggedRow.classList.remove("dragging");
    draggedRow = null;
    for (const r of providerOrderList.querySelectorAll(".provider-order-row.dragging")) {
      r.classList.remove("dragging");
    }
  });

  providerOrderList.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (!draggedRow) return;
    e.dataTransfer.dropEffect = "move";
    const after = getDragAfterElement(providerOrderList, e.clientY);
    if (after == null) {
      providerOrderList.appendChild(draggedRow);
    } else {
      providerOrderList.insertBefore(draggedRow, after);
    }
  });

  providerOrderList.addEventListener("drop", (e) => {
    e.preventDefault();
  });
}

async function load() {
  fillAutoRefreshSelect();
  const stored = await chrome.storage.local.get(["popupProviderPrefs", "autoRefreshMinutes"]);
  applyProviderPrefs(stored.popupProviderPrefs);

  let minutes = Number(stored.autoRefreshMinutes);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 120) minutes = DEFAULT_AUTO_REFRESH_MINUTES;
  if (!AUTO_REFRESH_OPTIONS.includes(minutes)) {
    minutes = AUTO_REFRESH_OPTIONS.reduce((prev, cur) =>
      Math.abs(cur - minutes) < Math.abs(prev - minutes) ? cur : prev
    );
  }
  autoRefreshSelect.value = String(minutes);
}

async function save() {
  const minutes = Number.parseInt(autoRefreshSelect.value, 10);
  const safeMinutes =
    Number.isFinite(minutes) && minutes >= 1 && minutes <= 120 ? minutes : DEFAULT_AUTO_REFRESH_MINUTES;

  await chrome.storage.local.set({
    popupProviderPrefs: readProviderPrefs(),
    autoRefreshMinutes: safeMinutes,
  });
  await chrome.storage.local.remove(LEGACY_STORAGE_KEYS);

  statusEl.textContent = "保存しました";
  window.setTimeout(() => {
    statusEl.textContent = "";
  }, 1800);
}

saveButton.addEventListener("click", save);
setupDragAndDrop();
void load();
