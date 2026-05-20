# Chrome Web Store 申請メモ（Unlisted）

ストアの入力に使う**文案の控え**と**最低限の手順**です。正本は `PRIVACY.md` と `manifest.json` です。

**申請用 ZIP はローカルで作り、Developer Dashboard からアップロードすれば足ります。** GitHub に ZIP を置く必要はありません。  
**`PRIVACY.md` だけは**ストアの Privacy policy URL 用に **GitHub 上に置く**のが一般的です（下記 URL）。

## 流れ

```text
1. ローカルで申請用 ZIP を作る（直下に manifest.json）
2. https://chrome.google.com/webstore/devconsole → New item → ZIP アップロード
3. Store listing / Privacy practices を入力
4. Distribution を Unlisted → Submit for review
```

## Privacy policy URL（ストア入力用）

- 表示用: `https://github.com/sinoda1114/AI-Usage-Monitor/blob/main/PRIVACY.md`
- 生テキスト: `https://raw.githubusercontent.com/sinoda1114/AI-Usage-Monitor/main/PRIVACY.md`

## Short description

```text
Cursor・Codex・Claude・Devin（オプション）の使用量を、ツールバーのポップアップでまとめて確認できる Chrome 拡張です。
```

### Short description（英語）

```text
Chrome extension that shows Cursor, Codex, Claude, and optional Devin usage in one toolbar popup.
```

## Detailed description

```text
AI Usage Monitor は、Cursor・Codex・Claude の使用量ページに表示される利用状況を読み取り、Chrome のツールバー上のポップアップにまとめて表示する拡張機能です。オプションで Devin（組織スラッグを設定した場合）にも対応します。

各サービスの使用量、リセット予定、残りクレジットなどをひとつの画面で確認できます。ポップアップと設定の表示言語は English / 日本語 / 简体中文 / 한국어 / Español から選べます。

主な機能:
・Cursor / Codex / Claude の使用量表示
・オプションで Devin（組織スラッグ設定時）
・ポップアップでの一覧表示
・手動更新
・自動更新の停止 / 再開
・表示対象サービスの切り替え
・表示順の変更
・表示言語の選択

データの扱い:
取得した情報は、このブラウザ内にのみ保存されます。
外部サーバーへの送信、第三者提供、広告利用、分析利用は行いません。

注意:
各サービスの公式使用量ページにログインしている必要があります（Devin を使う場合も同様）。
各サービスの画面構成が変更された場合、正しく取得できないことがあります。

サポート:
不具合報告、機能要望、質問は GitHub Issues からお願いします。
https://github.com/sinoda1114/AI-Usage-Monitor/issues
```

### Detailed description（英語ストア掲載用）

```text
AI Usage Monitor helps you check Cursor, Codex, Claude, and optionally Devin usage from one compact Chrome toolbar popup.

If you use multiple AI coding tools, checking each usage page separately can be time-consuming. This extension opens or reloads the official usage pages, reads the usage information shown on screen, and summarizes the latest status in one place.

You can quickly check:
• Usage for Cursor, Codex, and Claude
• Optional Devin usage when enabled in Options (daily/weekly quota, on-demand balance, and other metrics shown on the official page)
• Reset timing
• Remaining credits or usage limits
• Provider-specific metrics
• The latest stored snapshot from the toolbar popup

Key features:
• Compact popup next to the Chrome toolbar
• Manual refresh
• Pause / resume automatic background updates
• Choose which providers appear in the popup
• Drag-and-drop to reorder providers
• Auto-refresh interval setting, from 1 to 120 minutes
• Display language for the popup and options UI (English, Japanese, Simplified Chinese, Korean, Spanish)

Optional Devin support:
Devin is off by default. In Options, enable Devin, enter your organization slug (the name after /org/ in your Devin usage URL, for example: https://app.devin.ai/org/my-org/settings/usage), and save.

How it works:
After installation, the extension opens or reloads the official usage pages for each enabled service and reads the numbers displayed on those pages. Tabs are not closed after collection. The extension does not inject ads or on-page overlays.

Data handling:
Usage information is stored only in this browser. Nothing is sent to external servers, shared with third parties, or used for ads or analytics.

Notes:
You must be signed in to each service’s official usage page (including Devin when enabled). If a service changes its page layout or wording, parsing may stop working until the extension is updated.

Support:
For bug reports, feature requests, or questions, please use GitHub Issues:
https://github.com/sinoda1114/AI-Usage-Monitor/issues
```

## ユーザー向けサポート（運用）

Chrome Web Store 本体に専用のサポートチャットはなく、**開発者側で導線を用意する形**になります。このリポジトリでは **GitHub Issues** を案内しています。

- Issues: https://github.com/sinoda1114/AI-Usage-Monitor/issues  
- Issue テンプレートは `.github/ISSUE_TEMPLATE/` にあります（任意のときにご利用ください）。

## 権限の説明（聞かれたら）

権限: `alarms`, `storage`, `tabs`, `scripting`  
ホスト: `cursor.com`, `chatgpt.com`, `claude.ai`, `app.devin.ai`, `*.devin.ai`

**tabs** — 各サービスの公式使用量ページを開く、または再読み込みして情報を取得するために使用します。対象 URL に限定しています。

**storage** — メトリクス・最終更新・表示設定・更新停止状態・自動更新間隔（分）・表示言語・Devin 組織スラッグをブラウザ内に保存するため。外部へ送信しない。

**alarms** — 定期的に使用量を確認しポップアップ用データを更新するため。

**scripting** — 上記各サービスの使用量ページにだけ `usage-collector.js` を登録し、ページ上に表示されている使用量を読み取るため。他サイトへの任意実行やページ上 UI の注入は行いません。

**host_permissions** — 使用量ページのタブを検出・バックグラウンドで開閉・再読み込みするため。上記ドメインの公式 usage ページのみ。

### ホスト権限が必要な理由（Privacy タブ用・英語）

```text
Host permissions are required because this extension only reads usage metrics already shown on each supported service’s official usage page and displays them in the toolbar popup.

We use these hosts only for:
• https://cursor.com/* — open or reload the Cursor usage (spending) page and run the usage collector on that page
• https://chatgpt.com/* — open or reload the ChatGPT Codex usage analytics page and run the collector there
• https://claude.ai/* — open or reload Claude’s usage settings page and run the collector there
• https://app.devin.ai/* and https://*.devin.ai/* — when the user enables Devin in Options, open or reload that organization’s official usage page (e.g. …/org/my-org/settings/usage) and run the collector there

Host access is used to find existing tabs, open or reload the correct usage tabs in the background, and register a content script only on those usage pages. The extension does not inject ads or on-page overlays, does not collect passwords or payment data, and does not send any information to external servers.
```

### scripting 権限（Privacy タブ用・英語）

```text
The scripting permission is used only to register a content script on the supported official usage-page URLs listed above (Cursor, Codex, Claude, and Devin when enabled). The script reads usage metrics already displayed on those pages and saves them locally in Chrome for the extension popup. It does not run on other websites, does not inject on-page UI, and does not send data to external servers.
```

## Store listing の目安

| 項目 | 案 |
| --- | --- |
| Category | Productivity |
| Language | Japanese / English（ほか zh_CN, ko, es の UI 対応） |
| Visibility | **Unlisted** |

## Privacy practices（方針）

- 外部送信・第三者提供・広告・分析に使わない、と答えられる内容（`PRIVACY.md` と一致）
- データカテゴリは、対象サービスの使用量ページ上の表示内容を読み取るため、保守的に **Website content** / **User activity** を選択する方針。ただし、パスワード・認証トークン・支払い情報・位置情報・個人間メッセージは取得しない。
- 上記の「取得しない」項目は、フォームで該当する箇所は **No** と答えられるようにする

## 申請用 ZIP（ローカルで作成）

**リポジトリの `releases/ai-usage-monitor-store-v*.zip` は、下のスクリプトで生成したものと同じです。**  
古い ZIP（例: `v0.2.5`）は **`usage-collector.js` / `i18n.js` / `_locales` が入っておらず現在の拡張と不一致**です。必ず `manifest.json` の `version` に合わせて作り直してください。

リポジトリの**ルート**で実行。ZIP を開いた**いちばん上の階層に `manifest.json` がある**こと（余計な親フォルダだけ丸ごと入れない）。

### 推奨（Python・Windows / macOS / Linux 共通）

```bash
python scripts/package-store-zip.py
```

`releases/ai-usage-monitor-store-v<version>.zip` が出力されます（`<version>` は `manifest.json` と同じ）。

**リポジトリ同梱の申請用 ZIP（例）:** `releases/ai-usage-monitor-store-v0.5.1.zip`

### PowerShell（手動で ZIP するとき）

```powershell
$version = (Get-Content manifest.json | ConvertFrom-Json).version
$zip = "releases/ai-usage-monitor-store-v$version.zip"
Remove-Item $zip -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path releases | Out-Null
Compress-Archive `
  -Path manifest.json, background.js, usage-collector.js, i18n.js, `
    popup.html, popup.js, popup.css, `
    options.html, options.js, icons, _locales `
  -DestinationPath $zip
Get-Item $zip
```

できあがった ZIP を Developer Dashboard にアップロードする。

## 申請前チェック

```text
□ ZIP 直下に manifest.json がある
□ chrome://extensions で展開フォルダを読み込み動作確認
□ version が申請内容と一致
□ Privacy policy URL を入力済み
□ icons/icon-128.png が存在する
□ ZIP に usage-collector.js / i18n.js / _locales/** が含まれる
□ ZIP に .git / node_modules / .env / 不要な開発ファイルが入っていない
□ ストア用スクリーンショットを 1 枚以上用意
□ 説明文の末尾に サポート（GitHub Issues） を記載済み
□ scripting / host_permissions の理由を Privacy タブに入力済み
```
