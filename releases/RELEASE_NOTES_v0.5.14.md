## AI Usage Monitor v0.5.14

### 主な変更

#### Claude（API寄り）
- usage ページが使う同一オリジン JSON（`/api/organizations` → `/api/organizations/{id}/usage`）を優先して読み取るようにしました。
- 文言・ロケール変更に強くなります。失敗時や空レスポンス時は従来の DOM テキストパースにフォールバックします。
- ルーティン実行数・Claude Design など JSON に無い項目は、取得できる場合のみ DOM から補完します。

#### その他
- JSON 写像のフィクスチャテスト（`scripts/test-claude-api-map.mjs`）を追加
- PRIVACY / STORE_LISTING を「同一オリジンの使用量レスポンス読み取り」に合わせて更新

### インストール

1. **`ai-usage-monitor-store-v0.5.14.zip`** を展開
2. `chrome://extensions` → デベロッパーモード → 「パッケージ化されていない拡張機能を読み込む」
3. 展開フォルダを選択し、Claude usage タブを F5 で再読み込み

### English summary

- Claude collection now prefers the same-origin usage JSON the settings page already loads, with DOM text as fallback.
- Local-only storage unchanged; no external transmission.

Download **`ai-usage-monitor-store-v0.5.14.zip`**.
