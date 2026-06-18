import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, "..", "usage-collector.js"), "utf8");

function runCollectorWithText(pageText) {
  const body = {
    innerText: pageText,
    childNodes: [],
    shadowRoot: null,
    childElementCount: 0,
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
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    document: {
      body,
      title: "Codex Analytics",
      addEventListener() {},
      querySelectorAll() {
        return [];
      },
    },
    window: {
      location: {
        href: "https://chatgpt.com/codex/cloud/settings/analytics#usage",
        hostname: "chatgpt.com",
      },
      addEventListener() {},
      setTimeout() {
        return 0;
      },
      clearTimeout() {},
    },
    chrome: {
      runtime: { id: "test", onMessage: { addListener() {} } },
      storage: { onChanged: { addListener() {} }, local: { get: async () => ({}) } },
    },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.metricsFromBars("codex");
}

const metrics = runCollectorWithText(
  "Codex の上限まであと少しです。5時間枠の上限は2026/06/19 1:50にリセットされます。 " +
    "残高 5時間の使用制限 6% 残り リセット: 2026/06/19 1:50 " +
    "週間利用上限 65% 残り リセット: 2026/06/25 9:04 " +
    "残りのクレジット 0"
);

const compactMetrics = runCollectorWithText(
  "5時間の使用制限 86% 使用済み リセット: 6:52 週間利用上限 61% 残り リセット: 2026/06/25 9:04"
);

const fiveHour = metrics.find((m) => m.id === "codex-five-hour");
const weekly = metrics.find((m) => m.id === "codex-weekly");
const credits = metrics.find((m) => m.id === "codex-credits");
const compactFiveHour = compactMetrics.find((m) => m.id === "codex-five-hour");
const compactWeekly = compactMetrics.find((m) => m.id === "codex-weekly");
const problems = [];

if (fiveHour?.usedPercentage !== 94) problems.push(`five-hour value bad: ${fiveHour?.usedPercentage}`);
if (fiveHour?.resetAt !== "2026/06/19 1:50") problems.push(`five-hour reset bad: ${fiveHour?.resetAt}`);
if (weekly?.usedPercentage !== 35) problems.push(`weekly value bad: ${weekly?.usedPercentage}`);
if (weekly?.resetAt !== "2026/06/25 9:04") problems.push(`weekly reset bad: ${weekly?.resetAt}`);
if (credits?.detail !== "0") problems.push(`credits bad: ${credits?.detail}`);
if (compactFiveHour?.resetAt !== "6:52") {
  problems.push(`compact five-hour reset leaked: ${compactFiveHour?.resetAt}`);
}
if (compactWeekly?.usedPercentage !== 39) {
  problems.push(`compact weekly value bad: ${compactWeekly?.usedPercentage}`);
}

if (problems.length > 0) {
  console.error("NG Codex parse");
  for (const metric of metrics) console.error(metric);
  for (const problem of problems) console.error("!", problem);
  process.exit(1);
}

console.log("OK Codex parse: remaining values converted to used percentages and reset datetimes preserved");
