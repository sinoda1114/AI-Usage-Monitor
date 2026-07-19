import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, "..", "usage-collector.js"), "utf8");

const text =
  "CURRENT PLAN Pro $20/mo Resets on 8月18日 (30 days remaining) " +
  "Included in Pro Total 14% 6% First-Party Models and 69% API used " +
  "First-Party Models 6% Additional usage beyond limits consumes API quota " +
  "API 69% Additional usage beyond limits consumes on-demand spend.";

const body = { innerText: text, childNodes: [], shadowRoot: null, childElementCount: 0 };
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
    title: "Cursor usage",
    addEventListener() {},
    querySelectorAll() { return []; },
  },
  window: {
    location: { href: "https://cursor.com/settings", hostname: "cursor.com" },
    addEventListener() {},
    setTimeout() { return 0; },
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

const metrics = sandbox.metricsFromBars("cursor");
const expected = new Map([
  ["cursor-total", 14],
  ["cursor-first-party-models", 6],
  ["cursor-api", 69],
]);
const problems = [];
for (const [id, percentage] of expected) {
  const metric = metrics.find((candidate) => candidate.id === id);
  if (metric?.usedPercentage !== percentage) problems.push(`${id} != ${percentage}`);
}

console.log(`metrics: ${metrics.map((metric) => `${metric.id}=${metric.usedPercentage}%`).join(", ")}`);
if (problems.length > 0) {
  console.error(`NG: ${problems.join(", ")}`);
  process.exit(1);
}
console.log("OK Cursor parse: Total, First-Party Models, and API");
