import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, "..", "usage-collector.js"), "utf8");
const fixture = JSON.parse(
  fs.readFileSync(path.join(here, "fixtures", "claude-usage-sample.json"), "utf8")
);

function loadCollector() {
  const body = {
    innerText: "",
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
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    document: documentStub,
    window: windowStub,
    chrome: chromeStub,
    fetch: async () => {
      throw new Error("fetch should not be called in map unit test");
    },
  };
  sandbox.globalThis = sandbox;
  sandbox.window.location.href = "https://claude.ai/settings/usage";
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox;
}

const sandbox = loadCollector();
const metrics = sandbox.mapClaudeUsageJson(fixture);

const byId = Object.fromEntries(metrics.map((m) => [m.id, m]));
const problems = [];

if (byId["claude-current-session"]?.usedPercentage !== 17) {
  problems.push(`current% != 17 got ${byId["claude-current-session"]?.usedPercentage}`);
}
if (byId["claude-weekly"]?.usedPercentage !== 11) {
  problems.push(`weekly% != 11 got ${byId["claude-weekly"]?.usedPercentage}`);
}
if (byId["claude-sonnet"]?.usedPercentage !== 5) {
  problems.push(`sonnet% != 5 got ${byId["claude-sonnet"]?.usedPercentage}`);
}
if (byId["claude-opus"]?.usedPercentage !== 5) {
  problems.push(`opus% != 5 got ${byId["claude-opus"]?.usedPercentage}`);
}
if (byId["claude-fable"]?.usedPercentage !== 2) {
  problems.push(`fable% != 2 got ${byId["claude-fable"]?.usedPercentage}`);
}
if (byId["claude-extra"]?.usedPercentage !== 0) {
  problems.push(`extra% != 0 got ${byId["claude-extra"]?.usedPercentage}`);
}
if (byId["claude-extra"]?.detail !== "$0 / $10") {
  problems.push(`extra detail bad: ${byId["claude-extra"]?.detail}`);
}
if (!byId["claude-current-session"]?.resetAt) {
  problems.push("current resetAt missing");
}

// 0–1 scale normalization (strict fraction only)
const frac = sandbox.mapClaudeUsageJson({
  five_hour: { utilization: 0.42, resets_at: "2099-01-01T00:00:00Z" },
});
if (frac[0]?.usedPercentage !== 42) {
  problems.push(`0.42 should map to 42%, got ${frac[0]?.usedPercentage}`);
}

// Critical: utilization 1 must mean 1%, not 100%
const onePercent = sandbox.mapClaudeUsageJson({
  five_hour: { utilization: 1, resets_at: "2099-01-01T00:00:00Z" },
});
if (onePercent[0]?.usedPercentage !== 1) {
  problems.push(`utilization:1 should be 1%, got ${onePercent[0]?.usedPercentage}`);
}

// Fable field
const fable = sandbox.mapClaudeUsageJson({
  seven_day_fable: { utilization: 2, resets_at: "2099-01-01T00:00:00Z" },
});
if (fable[0]?.id !== "claude-fable" || fable[0]?.usedPercentage !== 2) {
  problems.push(`fable not mapped, got ${JSON.stringify(fable[0])}`);
}

// empty / null windows ignored
const empty = sandbox.mapClaudeUsageJson({
  five_hour: null,
  seven_day: { utilization: null, resets_at: null },
});
if (empty.length !== 0) problems.push(`expected no metrics for null windows, got ${empty.length}`);

console.log("=== Claude JSON map ===");
for (const m of metrics) {
  console.log(
    `  - [${m.id}] "${m.label}" => ${m.usedPercentage}%` +
      (m.resetAt ? ` / reset: ${m.resetAt}` : "")
  );
}

if (problems.length) {
  for (const p of problems) console.log(`  ! ${p}`);
  console.log("NG ❌");
  process.exit(1);
}
console.log("OK ✅");
