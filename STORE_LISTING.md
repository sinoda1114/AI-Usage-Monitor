# Chrome Web Store 申請メモ（Unlisted 想定）

このファイルは **ストアの入力欄に貼る文案の控え** と **作業手順** です。公開内容の正本は `PRIVACY.md` と `manifest.json` です。

## 全体の流れ

```text
1. 申請前ファイルを整える（本リポジトリの PRIVACY.md / このファイル）
2. 申請用 ZIP を作る（直下に manifest.json）
3. Chrome Web Store Developer Dashboard に入る
4. New item で ZIP をアップロード
5. Store listing を入力
6. Privacy practices を入力
7. Distribution を Unlisted にする
8. Submit for review
```

## プライバシーポリシー URL（ストアの入力用）

審査フォームの「Privacy policy」には、次のいずれかを貼れます。

- ブラウザで読みやすい表示: `https://github.com/sinoda1114/AI-Usage-Monitor/blob/main/PRIVACY.md`
- 生テキスト（Markdown）: `https://raw.githubusercontent.com/sinoda1114/AI-Usage-Monitor/main/PRIVACY.md`

GitHub Pages を別途用意する場合は、その URL に差し替えてください。

## Short description（短い説明）

```text
Cursor・Codex・Claude の使用量をまとめて確認できる Chrome 拡張です。
```

## Detailed description（詳しい説明）

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

## 権限説明（ストアが理由を聞いたとき用）

現在の `manifest.json` の権限:

```json
"permissions": ["alarms", "storage", "tabs"]
```

### `tabs`

```text
Cursor・Codex・Claude の使用量ページを開く、または再読み込みして、使用量情報を取得するために使用します。対象ページは manifest.json で指定した各サービスの使用量ページに限定しています。
```

### `storage`

```text
取得した使用量メトリクス、最終更新時刻、表示設定、更新停止状態を、このブラウザ内に保存するために使用します。保存した情報は外部サーバーへ送信しません。
```

### `alarms`

```text
定期的に使用量ページを確認し、ポップアップに表示するデータを更新するために使用します。
```

## Store listing の目安

| 項目 | 案 |
| --- | --- |
| Category | Productivity |
| Language | Japanese（または English。説明と揃える） |
| Visibility | **Unlisted**（URL を知っている人だけがインストール可能） |
| Unlisted の理由（聞かれたら） | URL を知っている人だけに配布したいため |

## Developer Dashboard

```text
https://chrome.google.com/webstore/devconsole
```

1. Developer Dashboard を開く  
2. 初回なら開発者登録を行う  
3. 「New item」/「新しいアイテム」で ZIP をアップロード  
4. エラーがなければ各入力画面へ進む  

## Privacy practices（入力の方針）

この拡張は外部サーバーへ送信しませんが、対象ページ上の使用量表示を読み取ります。

- 外部送信しない / 第三者提供しない / 広告・分析に使わない、と明確に答える  
- データカテゴリは審査画面の選択肢に合わせ、迷う場合は **Website content** / **User activity** を検討（利用状況メトリクスをページから読み取るため）  
- **パスワード・認証情報・支払い・位置・個人の通信内容は取得しない** → 各項目で No と答えられるようにする  

## 申請用 ZIP（すぐ使えるもの）

`main` に **`releases/ai-usage-monitor-store-v0.2.0.zip`** を置いています。Developer Console の **New item** にそのままアップロードしてかまいません。

- ブラウザで取る場合: [releases/ai-usage-monitor-store-v0.2.0.zip（raw ダウンロード）](https://github.com/sinoda1114/AI-Usage-Monitor/raw/main/releases/ai-usage-monitor-store-v0.2.0.zip)

`manifest.json` の `version` を上げたあとは、下の PowerShell で作り直し、同じフォルダに上書きコミットするか、ファイル名の版番号を合わせてください。

## 申請用 ZIP の作り方（Windows PowerShell）

リポジトリのルートで実行。ZIP を開いた**一番上の階層に `manifest.json` がある**状態にしてください（余計な親フォルダだけ入っている形は避ける）。出力先は `releases/ai-usage-monitor-store-v$version.zip` にすると GitHub 上の配布と揃えやすいです。

```powershell
$version = "0.2.0"
$zip = "releases/ai-usage-monitor-store-v$version.zip"
New-Item -ItemType Directory -Force -Path releases | Out-Null
Remove-Item $zip -ErrorAction SilentlyContinue

Compress-Archive `
  -Path `
    manifest.json, `
    background.js, `
    content.js, `
    popup.html, `
    popup.js, `
    popup.css, `
    options.html, `
    options.js, `
    icons `
  -DestinationPath $zip

Get-Item $zip
```

**正しい ZIP の中身の例:**

```text
manifest.json
background.js
content.js
popup.html
popup.js
popup.css
options.html
options.js
icons/
```

**避けたい例（1 つ下のフォルダにだけ manifest がある）:**

```text
AI-Usage-Monitor/
  manifest.json
  background.js
```

## 申請前チェックリスト

```text
□ chrome://extensions で ZIP 展開版を読み込める
□ ポップアップが開く
□ Cursor / Codex / Claude の表示が出る
□ 設定画面が開く
□ 停止 / 再開が動く
□ icons/icon-128.png が存在する
□ manifest.json の version が申請する ZIP と一致している
□ ZIP 直下に manifest.json がある
□ 不要な .env や node_modules が ZIP に入っていない
□ Privacy Policy URL を用意した（PRIVACY.md の URL）
□ ストア用スクリーンショットを用意した
```

## おすすめの進め方（最初の一巡）

```text
1. GitHub に PRIVACY.md を追加し、main に push する
2. ストアの Privacy policy 欄に PRIVACY.md の URL を貼る（必要なら GitHub Pages も検討）
3. 上記 PowerShell で申請用 ZIP を作る
4. Developer Dashboard で New item → ZIP アップロード
5. Store listing 入力（このファイルの文案をコピー）
6. Privacy practices 入力
7. Distribution を Unlisted にする
8. Submit for review
```
