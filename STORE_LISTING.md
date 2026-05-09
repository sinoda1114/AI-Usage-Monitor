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

データの扱い:
取得した情報は、このブラウザ内にのみ保存されます。
外部サーバーへの送信、第三者提供、広告利用、分析利用は行いません。

注意:
各サービスの公式使用量ページにログインしている必要があります。
各サービスの画面構成が変更された場合、正しく取得できないことがあります。
```

## 権限の説明（聞かれたら）

権限: `alarms`, `storage`, `tabs`

**tabs** — 各サービスの使用量ページを開く・再読み込みして情報を取得するため。対象 URL は manifest の content_scripts で限定。

**storage** — メトリクス・最終更新・表示設定・更新停止状態をブラウザ内に保存するため。外部へ送信しない。

**alarms** — 定期的に使用量を確認しポップアップ用データを更新するため。

## Store listing の目安

| 項目 | 案 |
| --- | --- |
| Category | Productivity |
| Language | Japanese（または English） |
| Visibility | **Unlisted** |

## Privacy practices（方針）

- 外部送信・第三者提供・広告・分析に使わない、と答えられる内容（`PRIVACY.md` と一致）
- データカテゴリはフォームの選択肢に合わせる。迷う場合は **Website content** / **User activity** を検討
- パスワード・認証トークン・支払い情報などは取得しない → 該当項目は No

## 申請用 ZIP（ローカルで作成）

リポジトリの**ルート**で実行。ZIP を開いた**いちばん上の階層に `manifest.json` がある**こと（余計な親フォルダだけ丸ごと入れない）。

```powershell
$version = "0.2.0"
$zip = "ai-usage-monitor-store-v$version.zip"
Remove-Item $zip -ErrorAction SilentlyContinue
Compress-Archive `
  -Path manifest.json, background.js, content.js, `
    popup.html, popup.js, popup.css, `
    options.html, options.js, icons `
  -DestinationPath $zip
Get-Item $zip
```

できあがった `$zip` を Dashboard にアップロードする。

## 申請前チェック

```text
□ ZIP 直下に manifest.json がある
□ chrome://extensions で展開フォルダを読み込み動作確認
□ version が申請内容と一致
□ Privacy policy URL を入力済み
□ スクリーンショット用意
```
