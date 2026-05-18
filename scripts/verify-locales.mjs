/**
 * Verify all locale message files share the same keys as en.
 * Run: node scripts/verify-locales.mjs
 */

import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const localesDir = join(root, "_locales");
const base = JSON.parse(readFileSync(join(localesDir, "en", "messages.json"), "utf8"));
const baseKeys = Object.keys(base).sort();

let failed = 0;
for (const locale of readdirSync(localesDir)) {
  const path = join(localesDir, locale, "messages.json");
  const data = JSON.parse(readFileSync(path, "utf8"));
  const keys = Object.keys(data).sort();
  const missing = baseKeys.filter((k) => !keys.includes(k));
  const extra = keys.filter((k) => !baseKeys.includes(k));
  if (missing.length || extra.length) {
    console.error(`FAIL ${locale}: missing=[${missing.join(", ")}] extra=[${extra.join(", ")}]`);
    failed++;
  } else {
    console.log(`OK ${locale} (${keys.length} keys)`);
  }
}

process.exit(failed > 0 ? 1 : 0);
