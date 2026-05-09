# AI Usage Monitor（Chrome 拡張）

Cursor / Codex / Claude の使用量ページからメトリクスを読み取り、ダッシュボードへ送信する Manifest V3 拡張です。

リポジトリ: [github.com/sinoda1114/AI-Usage-Monitor](https://github.com/sinoda1114/AI-Usage-Monitor)

## 置き場所

このフォルダは **`limit-dashboard` と同じ階層**（例: `OneDrive\Dev\AI-Usage-Monitor`）を想定しています。

## 開発用読み込み

1. `chrome://extensions` → デベロッパーモード ON
2. 「パッケージ化されていない拡張機能を読み込む」→ **このフォルダ**（`manifest.json` がある階層）を指定

## GitHub Releases（初回 push 以降）

1. リモートは `origin` → `https://github.com/sinoda1114/AI-Usage-Monitor.git` を想定
2. `manifest.json` の `version` を更新して push
3. タグを作成: `git tag v0.1.0 && git push origin v0.1.0`
4. `.github/workflows/release.yml` により、拡張本体ファイルのみを含む zip がリリース資産として添付されます

## 公開前チェック（推奨）

- `ingestToken` のようなトークン値を、コードへ直書きしていないことを確認
- `.env` や秘密鍵ファイル（`*.pem` / `*.key`）がコミット対象に入っていないことを確認
- `host_permissions` は必要最小限のドメインに絞る
- `manifest.json` の `version` を更新し、READMEの手順と一致していることを確認
- リリース zip に不要物（`.git` / ローカル設定 / ログ）が含まれないことを確認

## ダッシュボード側

Web ダッシュボードは別リポジトリ（例: `limit-dashboard`）で起動し、拡張のオプションで `Dashboard URL` と `Collector Token` を設定します。
