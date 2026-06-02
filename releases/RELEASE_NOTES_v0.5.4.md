## AI Usage Monitor v0.5.4

Chrome 拡張の Store 申請・手動インストール用リリースです。

### 主な変更（v0.5.4）

#### Claude
- **週間制限などのリセット時刻が他セクションへ混線する不具合を修正。** セクション見出し → そのセクションの % → 直後のリセット文言、のみを読むスライス方式に変更し、リセット時刻が必ず自分のセクションに紐づくようにしました。
- 日本語 UI のリセット時刻（例:「3時間15分後にリセット」「11月8日にリセット」）も正しく取得できるようになりました。

### インストール

1. 下の **`ai-usage-monitor-store-v0.5.4.zip`** をダウンロードして展開
2. `chrome://extensions` → デベロッパーモード → 「パッケージ化されていない拡張機能を読み込む」
3. 展開フォルダ（`manifest.json` がある階層）を選択

### サポート

不具合・要望: [GitHub Issues](https://github.com/sinoda1114/AI-Usage-Monitor/issues)

---

## English summary

- **Fix:** Claude reset times no longer bleed across sections (e.g. the weekly limit inheriting the current-session reset). Each section's reset is now read only from the text right after its own percentage.
- Japanese-UI reset strings (e.g. "3時間15分後にリセット", "11月8日にリセット") are now captured correctly.

Download **`ai-usage-monitor-store-v0.5.4.zip`** for Chrome Web Store or unpacked install.
