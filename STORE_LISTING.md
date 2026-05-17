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
Cursor・Codex・Claude の使用量をまとめて確認できる Chrome 拡張です。
```

### Short description（英語）

```text
Chrome extension that shows Cursor, Codex, and Claude usage in one popup.
```

## Detailed description

```text
AI Usage Monitor は、Cursor・Codex・Claude の使用量ページに表示される利用状況を読み取り、Chrome のツールバー上のポップアップにまとめて表示する拡張機能です。

各サービスの使用量、リセット予定、残りクレジットなどをひとつの画面で確認できます。

主な機能:
・Cursor / Codex / Claude の使用量表示
・ポップアップでの一覧表示
・手動更新
・自動更新の停止 / 再開
・表示対象サービスの切り替え
・表示順の変更

・オプションで Devin の使用量（組織スラッグを設定した場合）

データの扱い:
取得した情報は、このブラウザ内にのみ保存されます。
外部サーバーへの送信、第三者提供、広告利用、分析利用は行いません。

注意:
各サービスの公式使用量ページにログインしている必要があります。
各サービスの画面構成が変更された場合、正しく取得できないことがあります。

サポート:
不具合報告、機能要望、質問は GitHub Issues からお願いします。
https://github.com/sinoda1114/AI-Usage-Monitor/issues
```

### Detailed description（英語ストア掲載用）

```text
AI Usage Monitor reads usage information shown on Cursor, Codex, and Claude usage pages (and optionally Devin when you add your organization slug), and displays it in a Chrome toolbar popup.

You can see usage, reset timings, credits, and limits in one place.

Features:
- Usage for Cursor / Codex / Claude
- Optional Devin usage when you configure your organization slug
- Summary in the extension popup
- Manual refresh
- Pause / resume automatic refresh
- Toggle which providers are shown
- Reorder providers

Data handling:
Information is stored only in this browser.
It is not sent to external servers, not shared with third parties, and not used for ads or analytics.

Notes:
You must be signed in to each service's official usage page.
If those pages change, metrics may stop updating correctly.

Support:
For bug reports, feature requests, or questions, please use GitHub Issues:
https://github.com/sinoda1114/AI-Usage-Monitor/issues
```

## ユーザー向けサポート（運用）

Chrome Web Store 本体に専用のサポートチャットはなく、**開発者側で導線を用意する形**になります。このリポジトリでは **GitHub Issues** を案内しています。

- Issues: https://github.com/sinoda1114/AI-Usage-Monitor/issues  
- Issue テンプレートは `.github/ISSUE_TEMPLATE/` にあります（任意のときにご利用ください）。

## 権限の説明（聞かれたら）

権限: `alarms`, `storage`, `tabs`

**tabs** — Cursor・Codex・Claude・Devin（設定済みの組織スラッグがある場合）の使用量ページを開く、または再読み込みして情報を取得するために使用します。実装上、対象は manifest.json に記載した各サービスの使用量ページに限定しています。

**storage** — メトリクス・最終更新・表示設定・更新停止状態・自動更新間隔（分）をブラウザ内に保存するため。外部へ送信しない。

**alarms** — 定期的に使用量を確認しポップアップ用データを更新するため。

## Store listing の目安

| 項目 | 案 |
| --- | --- |
| Category | Productivity |
| Language | Japanese（または English） |
| Visibility | **Unlisted** |

## Privacy practices（方針）

- 外部送信・第三者提供・広告・分析に使わない、と答えられる内容（`PRIVACY.md` と一致）
- データカテゴリは、対象サービスの使用量ページ上の表示内容を読み取るため、保守的に **Website content** / **User activity** を選択する方針。ただし、パスワード・認証トークン・支払い情報・位置情報・個人間メッセージは取得しない。
- 上記の「取得しない」項目は、フォームで該当する箇所は **No** と答えられるようにする

## 申請用 ZIP（ローカルで作成）

**リポジトリの `releases/ai-usage-monitor-store-v*.zip` は、下のスクリプトで生成したものと同じです。**  
（古い `v0.2.5` の ZIP は **`i18n.js` / `_locales` が入っておらず現在の拡張と不一致**です。必ず `manifest.json` の `version` に合わせて作り直してください。）

リポジトリの**ルート**で実行。ZIP を開いた**いちばん上の階層に `manifest.json` がある**こと（余計な親フォルダだけ丸ごと入れない）。

### 推奨（Python・Windows / macOS / Linux 共通）

```bash
python scripts/package-store-zip.py
```

`releases/ai-usage-monitor-store-v<version>.zip` が出力されます（`<version>` は `manifest.json` と同じ）。

**リポジトリ同梱の申請用 ZIP（例）:** `releases/ai-usage-monitor-store-v0.4.0.zip` — `manifest.json` の `version` とファイル名を揃えてあるときは、そのまま Developer Dashboard にアップロードできる構成です。

### PowerShell（手動で ZIP するとき）

```powershell
$version = (Get-Content manifest.json | ConvertFrom-Json).version
$zip = "ai-usage-monitor-store-v$version.zip"
Remove-Item $zip -ErrorAction SilentlyContinue
Compress-Archive `
  -Path manifest.json, background.js, content.js, i18n.js, `
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
□ ZIP に **`i18n.js`** と **`_locales/**`** が含まれる（多言語対応以降は必須）
□ ZIP に .git / node_modules / .env / 不要な開発ファイルが入っていない
□ ストア用スクリーンショットを 1 枚以上用意
□ 説明文の末尾に **サポート（GitHub Issues）** を記載済み（本書「Detailed description」参照）
```
