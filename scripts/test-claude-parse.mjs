import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, "..", "usage-collector.js"), "utf8");

function runCollectorWithText(pageText) {
  // Minimal DOM/Chrome stubs. compactText() falls back to document.body.innerText
  // when the walk finds no text nodes, so we expose innerText directly.
  const body = {
    innerText: pageText,
    childNodes: [],
    shadowRoot: null,
    childElementCount: 0,
  };
  const documentStub = {
    body,
    title: "Settings - Claude",
    addEventListener() {},
    querySelectorAll() {
      return [];
    },
  };
  const windowStub = {
    location: { href: "https://claude.ai/settings/usage", hostname: "claude.ai" },
    addEventListener() {},
    setTimeout() {
      return 0;
    },
    clearTimeout() {},
  };
  const chromeStub = {
    runtime: { id: "test", onMessage: { addListener() {} } },
    storage: { onChanged: { addListener() {} }, local: { get: async () => ({}) } },
  };
  const sandbox = {
    console,
    Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 },
    URL,
    Number,
    Math,
    Boolean,
    String,
    WeakSet,
    Date,
    document: documentStub,
    window: windowStub,
    chrome: chromeStub,
  };
  sandbox.globalThis = sandbox;
  sandbox.window.location.href = "https://claude.ai/settings/usage";
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.metricsFromBars("claude");
}

const cases = [
  {
    name: "日本語 UI（現在のセッション + 週間制限 + 追加使用量）",
    text:
      "使用量 現在のセッション 42% 使用済み 3時間 15分後にリセット " +
      "週間制限 すべてのモデル 18% 使用済み 11月8日 にリセット " +
      "追加使用量 5% 使用 今月",
  },
  {
    name: "日本語 UI（リセットがパーセントの前に出る設定画面）",
    text:
      "プラン使用制限 Max (5x) " +
      "現在のセッション 2時間29分後にリセット 22% 使用済み " +
      "週間制限 使用制限について詳しく見る すべてのモデル 0:59 (日)にリセット 71% 使用済み",
  },
  {
    name: "英語 UI（current session + weekly + extra usage）",
    text:
      "Usage current session 67% used Resets in 2 hours later " +
      "weekly all models 33% used Resets on Nov 8 " +
      "extra usage 12% used this month",
  },
  {
    name: "日本語 UI（ルーティン実行数）",
    text: "1日の含まれるルーティン実行数 routine runs 3 / 10 毎日",
  },
];

// Per-case assertions: verify reset times stay scoped to their own section.
const expectations = {
  "日本語 UI（現在のセッション + 週間制限 + 追加使用量）": (metrics) => {
    const current = metrics.find((m) => m.id === "claude-current-session");
    const weekly = metrics.find((m) => m.id === "claude-weekly");
    const extra = metrics.find((m) => m.id === "claude-extra");
    const problems = [];
    if (current?.usedPercentage !== 42) problems.push("current% != 42");
    if (current?.resetAt !== "3時間 15分後にリセット") problems.push(`current reset bad: ${current?.resetAt}`);
    if (weekly?.usedPercentage !== 18) problems.push("weekly% != 18");
    if (weekly?.resetAt !== "11月8日 にリセット") problems.push(`weekly reset bad: ${weekly?.resetAt}`);
    if (extra?.resetAt) problems.push(`extra should have no reset, got: ${extra.resetAt}`);
    return problems;
  },
  "日本語 UI（リセットがパーセントの前に出る設定画面）": (metrics) => {
    const current = metrics.find((m) => m.id === "claude-current-session");
    const weekly = metrics.find((m) => m.id === "claude-weekly");
    const problems = [];
    if (current?.usedPercentage !== 22) problems.push("current% != 22");
    if (current?.resetAt !== "2時間29分後にリセット") problems.push(`current reset bad: ${current?.resetAt}`);
    if (weekly?.usedPercentage !== 71) problems.push("weekly% != 71");
    if (weekly?.resetAt !== "0:59 (日)にリセット") problems.push(`weekly reset bad: ${weekly?.resetAt}`);
    return problems;
  },
  "英語 UI（current session + weekly + extra usage）": (metrics) => {
    const current = metrics.find((m) => m.id === "claude-current-session");
    const weekly = metrics.find((m) => m.id === "claude-weekly");
    const problems = [];
    if (current?.usedPercentage !== 67) problems.push("current% != 67");
    if (current?.resetAt !== "2 hours later") problems.push(`current reset bad: ${current?.resetAt}`);
    if (weekly?.usedPercentage !== 33) problems.push("weekly% != 33");
    // The bug was: weekly inherited current-session's "2 hours later" reset.
    if (weekly?.resetAt === "2 hours later") problems.push("weekly reset BLED from current session");
    if (weekly?.resetAt !== "Nov 8") problems.push(`weekly reset bad: ${weekly?.resetAt}`);
    return problems;
  },
  "日本語 UI（ルーティン実行数）": (metrics) => {
    const r = metrics.find((m) => m.id === "claude-routines");
    return r && r.detail === "3 / 10" ? [] : ["routines not parsed"];
  },
};

let pass = 0;
let fail = 0;
for (const c of cases) {
  const metrics = runCollectorWithText(c.text);
  const hasMetrics = Array.isArray(metrics) && metrics.length > 0;
  const problems = expectations[c.name] ? expectations[c.name](metrics) : [];
  const ok = hasMetrics && problems.length === 0;
  console.log(`\n=== ${c.name} ===`);
  console.log(`status: ${ok ? "OK ✅" : "NG ❌"} (count=${metrics.length})`);
  for (const m of metrics) {
    console.log(`  - [${m.id}] "${m.label}" => ${m.usedPercentage}%` +
      (m.resetAt ? ` / reset: ${m.resetAt}` : "") +
      (m.detail ? ` / detail: ${m.detail}` : ""));
  }
  for (const p of problems) console.log(`  ! ${p}`);
  ok ? pass++ : fail++;
}

console.log(`\n--- 合計: ${pass} OK / ${fail} NG ---`);
process.exit(fail > 0 ? 1 : 0);
