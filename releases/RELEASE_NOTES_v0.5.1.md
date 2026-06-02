## AI Usage Monitor v0.5.1

Chrome 拡張の Store 申請・手動インストール用リリースです。

### 主な変更（v0.4.12 〜 v0.5.1）

#### Devin
- Devin の使用量収集を追加（設定で表示 ON + 組織スラッグが必要）
- 正しい URL: `…/org/{slug}/settings/usage`
- Devin タブが未開でもバックグラウンドで usage ページを開く・再読み込み
- Daily / Weekly クォータのスクレイプ精度を改善

#### コレクタ / 安定性
- `content.js` → `usage-collector.js` に移行
- `chrome.scripting.registerContentScripts` で動的登録（更新時に古いスクリプトを差し替え）
- 拡張更新後、収集対象タブを自動リロード
- **v0.5.1:** 拡張コンテキスト無効化後の `snapshot send failed` ループを修正（Claude 等のタブで F5 推奨）

#### 多言語 UI（v0.5.0）
- ポップアップ・設定の表示言語: **English / 日本語 / 简体中文 / 한국어 / Español**
- 欠けた翻訳キーは英語にフォールバック
- ※ 各サービスの使用量ページ上のメトリクス名は、ページ側の言語のまま

#### 権限
- `scripting` — 使用量ページへのコレクタ登録のみ
- `host_permissions` — cursor.com / chatgpt.com / claude.ai / app.devin.ai（公式 usage ページ用）

#### その他
- ページ上のトースト・バッジは表示しない
- README / STORE_LISTING を現行機能に合わせて更新

### インストール

1. 下の **`ai-usage-monitor-store-v0.5.1.zip`** をダウンロードして展開
2. `chrome://extensions` → デベロッパーモード → 「パッケージ化されていない拡張機能を読み込む」
3. 展開フォルダ（`manifest.json` がある階層）を選択

### Devin を使う場合

設定で **Devin を表示** にチェックし、**組織スラッグ**（URL の `/org/` 直後、例: `my-org`）を保存してください。

### サポート

不具合・要望: [GitHub Issues](https://github.com/sinoda1114/AI-Usage-Monitor/issues)

---

## English summary

- Optional **Devin** usage collection (org slug in Options)
- **Five UI languages:** en, ja, zh_CN, ko, es
- Dynamic **usage-collector.js** via scripting API; no on-page overlays
- **v0.5.1:** stops console spam when extension context is invalidated after an update (reload usage tabs)

Download **`ai-usage-monitor-store-v0.5.1.zip`** for Chrome Web Store or unpacked install.
