# Usage API investigation (2026-07)

調査日: 2026-07-22  
対象: AI Usage Monitor が DOM テキストパースしている 4 プロバイダ  
方法: 公式ドキュメント再確認 + 複数の独立 OSS / 非公式ドキュメントによる内部エンドポイント照合  
制限: この環境では各サービスにログインできないため、**ライブ Network キャプチャは未実施**。実装前にログイン済み Chrome で 1 回ずつ検証すること。

## Summary

| Provider | Personal official API | Session / internal JSON | Verdict | Fit for this extension |
| --- | --- | --- | --- | --- |
| Claude | No (Console Usage API ≠ Pro/Max web quota) | Yes — `GET /api/organizations/{org}/usage` | **GO** (session JSON) | High |
| Cursor | Enterprise Admin / Analytics only | Yes — `GET /api/usage-summary` | **GO** (session JSON) | High |
| Codex | Enterprise Analytics only | Yes — `GET /backend-api/wham/usage` | **GO** (session JSON) | High |
| Devin | Enterprise consumption / ACU APIs only | Yes — `GET /api/{orgId}/billing/quota/usage` | **GO** (session JSON, needs live confirm) | Medium–High |

**Bottom line:** 個人向けの「きれいな公開 Usage API」は、半年前と同様にほぼ無い。一方で **usage ページ / CLI が既に叩いているセッション付き JSON** は 4 サービスとも有力。DOM 文言追従よりスキーマ追従の方がメンテしやすい。主経路は session JSON、DOM はフォールバック。

---

## 1. Claude

### Official

- [Anthropic Usage and Cost API](https://platform.claude.com/docs)（Console / API 課金）は **Pro/Max の rolling 5h・weekly とは別物**。
- 個人向けに公開された「settings/usage と同じ数字」の公式 API は見当たらない。

### Session JSON (undocumented)

| Item | Detail |
| --- | --- |
| Discover org | `GET https://claude.ai/api/organizations` → org uuid |
| Usage | `GET https://claude.ai/api/organizations/{orgId}/usage` |
| Auth | Logged-in web cookies (`sessionKey` 等)。拡張なら `credentials: "include"` で同一オリジン fetch |
| Extra (optional) | `.../overage_spend_limit` or `extra_usage` block on usage; subscription details endpoints vary by account |

**Reported response shape** (sources: [claude-usage SPEC](https://github.com/linuxlewis/claude-usage/blob/main/SPEC.md), [claude-web-usage](https://github.com/djd0723/claude-web-usage), [ClaudeUsageBar](https://github.com/Rohilalala/ClaudeUsageBar)):

```json
{
  "five_hour": { "utilization": 17.0, "resets_at": "2026-02-08T18:59:59Z" },
  "seven_day": { "utilization": 11.0, "resets_at": "2026-02-14T16:59:59Z" },
  "seven_day_sonnet": { "utilization": 0.0, "resets_at": null },
  "seven_day_opus": { "utilization": 5.0, "resets_at": "..." },
  "seven_day_oauth_apps": null,
  "seven_day_cowork": null,
  "extra_usage": {
    "is_enabled": false,
    "monthly_limit": null,
    "used_credits": null,
    "utilization": null
  }
}
```

注: `utilization` はソースによって **0–100** と **0.0–1.0** の両方の報告がある。実装時は `<= 1` なら ×100 する正規化が必要。

### Mapping → current collector metrics

| Extension metric id | UI label (approx) | JSON field |
| --- | --- | --- |
| `claude-current-session` | 現在のセッション / Current session | `five_hour.utilization` + `five_hour.resets_at` |
| `claude-weekly` | 週間制限 | `seven_day.utilization` + `seven_day.resets_at` |
| `claude-sonnet` | Sonnet weekly | `seven_day_sonnet` (when non-null) |
| (Opus weekly) | Opus | `seven_day_opus` (when non-null) |
| `claude-extra` | 追加使用量 | `extra_usage.utilization` (when enabled) |
| `claude-routines` | Routine runs | **Not in this payload** → DOM fallback or skip |
| `claude-design` | Claude Design | **Not confirmed in payload** → DOM fallback |

### Privacy / ToS

- Undocumented internal API; same data the settings page already loads.
- Extension stays local (no external upload) if fetch runs in content script / SW with user cookies.
- Update PRIVACY wording from “read on-page display” to “read same-origin usage response already used by the page”.

### Verdict: **GO** (first implementation candidate)

---

## 2. Cursor

### Official

- [Cursor Admin / Analytics APIs](https://cursor.com/docs/api): **Enterprise teams** only. Not suitable as default path for individual Pro users.

### Session JSON (undocumented)

Source: [dmwyatt unofficial dashboard API gist](https://gist.github.com/dmwyatt/1e9359b1862e7cbfe1e754fe4c8db764)

| Item | Detail |
| --- | --- |
| Summary | `GET https://cursor.com/api/usage-summary` |
| Auth | Cookie `WorkosCursorSessionToken` (httpOnly). Extension page/SW fetch with credentials works; page JS cannot read the cookie value. |
| CSRF | POST endpoints need `Origin: https://cursor.com`; GET summary does not. |
| Events (optional) | `POST /api/dashboard/get-filtered-usage-events` |

**Key fields for popup:**

```text
individualUsage.plan.totalPercentUsed
individualUsage.plan.autoPercentUsed
individualUsage.plan.apiPercentUsed
billingCycleEnd  → reset / cycle end
```

### Mapping → current collector metrics

| Extension metric | JSON field |
| --- | --- |
| Total | `individualUsage.plan.totalPercentUsed` |
| Auto + Composer | `individualUsage.plan.autoPercentUsed` |
| API | `individualUsage.plan.apiPercentUsed` |
| First-Party Models | may need live check against current spending UI (pool naming changed over time) |
| Reset | `billingCycleEnd` (ISO) formatted for display |

### Privacy / ToS

- Same as Claude: undocumented dashboard API, cookie session, local-only storage OK.
- Do not ask users to paste session tokens; rely on logged-in browser cookies.

### Verdict: **GO** (after Claude)

---

## 3. Codex (ChatGPT)

### Official

- [Codex Analytics API](https://learn.chatgpt.com/docs/enterprise/analytics-api): **Enterprise / workspace analytics**, API key scoped. Not the Plus/Pro personal 5h+weekly meters. Lag up to ~12h. **Skip as primary path.**

### Session JSON (undocumented; also used by Codex CLI)

Sources: [ClaudeUsageBar Codex path](https://github.com/Rohilalala/ClaudeUsageBar), [CodexBar docs](https://github.com/steipete/CodexBar/blob/main/docs/codex.md), [codex-accounts internals](https://github.com/wikty/codex-accounts/blob/main/docs/internals/codex-app-internals.md), OpenAI `codex-rs` backend client (`/wham/usage`).

| Item | Detail |
| --- | --- |
| Session token | `GET https://chatgpt.com/api/auth/session` → `accessToken` |
| Usage | `GET https://chatgpt.com/backend-api/wham/usage` with `Authorization: Bearer <accessToken>` |
| Credits (optional) | `GET .../wham/rate-limit-reset-credits` or `credits` block on usage |

**Shape:**

```json
{
  "rate_limit": {
    "primary_window": {
      "used_percent": 55,
      "limit_window_seconds": 18000,
      "reset_after_seconds": 2547,
      "reset_at": 1778670307
    },
    "secondary_window": {
      "used_percent": 8,
      "limit_window_seconds": 604800,
      "reset_after_seconds": 489405,
      "reset_at": 1779157165
    }
  },
  "credits": {
    "has_credits": false,
    "unlimited": false,
    "balance": "0"
  }
}
```

### Mapping → current collector metrics

| Extension metric id | JSON field |
| --- | --- |
| `codex-five-hour` | `rate_limit.primary_window.used_percent` + `reset_at` / `reset_after_seconds` |
| `codex-weekly` | `rate_limit.secondary_window.used_percent` + reset |
| `codex-credits` | `credits.balance` (detail string) |

Note: Extension currently opens `chatgpt.com/codex/cloud/settings/analytics#usage` (DOM). The **wham** endpoint is what Codex CLI polls and is a better source for the same limit bars than scraping analytics copy.

### Privacy / ToS

- Undocumented; Bearer from existing ChatGPT web session.
- Prefer fetch from chatgpt.com context so token never leaves the browser to third parties.

### Verdict: **GO**

---

## 4. Devin

### Official

- Enterprise v3 APIs: ACU limits, consumption daily breakdowns, etc. Need **Service User** + billing permissions. **Not** the self-serve daily/weekly quota UI path.

### Session JSON (undocumented; used by CodexBar)

Source: [CodexBar docs/devin.md](https://github.com/steipete/CodexBar/blob/main/docs/devin.md)

| Item | Detail |
| --- | --- |
| Usage | `GET https://app.devin.ai/api/<internal-org-id>/billing/quota/usage` |
| Auth | Bearer from Devin web session (localStorage / Authorization header on app requests) |
| Org id | Internal `org_...` id (not only the URL slug). Slug alone may be insufficient. |

Response (described): daily + weekly usage percentages and reset timestamps. Exact field names need live capture before coding.

### Mapping → current collector metrics

| Extension metric id | Expected |
| --- | --- |
| `devin-daily-quota` | daily % + reset |
| `devin-weekly-quota` | weekly % + reset |
| `devin-acu` / on-demand / credits | may still need DOM or other billing endpoints |

### Privacy / ToS

- Session token handling is sensitive. Prefer reading from an open app.devin.ai tab (content script) over asking users to paste tokens.
- Enterprise ACU path stays out of scope for default users.

### Verdict: **GO (provisional)** — confirm response schema live before implementing

---

## Decision matrix

| Provider | Path | Recommendation | DOM role |
| --- | --- | --- | --- |
| Claude | Session JSON | **Implement first** | Fallback for routines / design / unknown fields |
| Cursor | Session JSON | Implement second | Fallback if percent fields rename |
| Codex | Session JSON (`wham/usage`) | Implement third | Fallback if Bearer/session path fails |
| Devin | Session JSON (quota/usage) | Implement after live schema dump | Fallback for ACU / balance / credits |
| Any Enterprise-only official API | Skip as primary | Optional future for org admins only | — |

### PRIVACY / Store listing impact

Current story: read metrics shown on official usage pages.  
Proposed story (accurate for JSON path):

- Still only same-origin requests the product already makes for the logged-in user.
- No credentials pasted into the extension UI (ideal).
- No data sent to AI Usage Monitor servers (unchanged).
- Mention that internal response shapes may change; DOM fallback may still run.

---

## Next implementation scope (Claude first)

### Status (2026-07-22)

Implemented in `usage-collector.js` (v0.5.14):

- `mapClaudeUsageJson` / `fetchClaudeMetricsFromApi` / `collectClaudeMetrics`
- JSON preferred → DOM fallback (routines / design still merge from DOM when present)
- Fixture: `scripts/fixtures/claude-usage-sample.json`
- Test: `scripts/test-claude-api-map.mjs`

### Goals (minimal)

1. Prefer JSON fetch when on `claude.ai` (any logged-in tab may work; settings/usage not strictly required — ClaudeUsageBar pattern).
2. Map to existing snapshot `metrics[]` ids so popup/options need no UI rewrite.
3. Keep current DOM parser as fallback when fetch fails or returns empty / schema mismatch.
4. Add JSON fixtures + unit test (parallel to `scripts/test-claude-parse.mjs`).

### Suggested code shape

```text
usage-collector.js (or new usage-api-claude.js loaded with it)
  resolveOrgId()        → GET /api/organizations
  fetchClaudeUsage()    → GET /api/organizations/{id}/usage
  mapClaudeUsageJson()  → metrics[]
  sendSnapshot()        → try JSON; if metrics empty → metricsFromBars("claude")
```

### Acceptance checks

- [ ] Logged-in tab: snapshot `status: "ok"` with `claude-current-session` + `claude-weekly` without relying on Japanese/English label text.
- [ ] Logged-out / 401: falls back to DOM or `no-metrics` without crashing.
- [ ] `utilization` 0–1 and 0–100 both handled.
- [ ] Fixture test for sample JSON → expected metric ids/percentages.
- [ ] PRIVACY.md / STORE_LISTING.md one-line update when shipping.

### Out of scope for first PR

- Removing tab open/reload for Claude entirely (can keep background tab for cookie warmth / hybrid).
- Cursor / Codex / Devin JSON paths (follow-up PRs using this note).
- Enterprise API keys.
- Libretto or other external repair agents.

### Live verification checklist (before coding Claude)

1. Open `https://claude.ai/settings/usage` logged in.
2. DevTools → Network → filter `usage`.
3. Confirm `GET /api/organizations/.../usage` status 200 and copy one anonymized JSON (strip org id if publishing).
4. Confirm whether `Referer` / special headers are required (some reports mention Referer for 403 avoidance).
5. Confirm `GET /api/organizations` works from content script context.

---

## References

- ClaudeUsageBar — [README](https://github.com/Rohilalala/ClaudeUsageBar)
- claude-web-usage — [repo](https://github.com/djd0723/claude-web-usage)
- claude-usage SPEC — [SPEC.md](https://github.com/linuxlewis/claude-usage/blob/main/SPEC.md)
- Cursor unofficial dashboard API — [gist](https://gist.github.com/dmwyatt/1e9359b1862e7cbfe1e754fe4c8db764)
- Cursor official APIs — [docs](https://cursor.com/docs/api) (Enterprise)
- CodexBar Codex / Devin docs — [codex.md](https://github.com/steipete/CodexBar/blob/main/docs/codex.md), [devin.md](https://github.com/steipete/CodexBar/blob/main/docs/devin.md)
- OpenAI Codex Analytics API — [learn.chatgpt.com](https://learn.chatgpt.com/docs/enterprise/analytics-api) (Enterprise)
- Devin official billing docs — [usage](https://docs.devin.ai/admin/billing/usage), [enterprise](https://docs.devin.ai/admin/billing/enterprise)
