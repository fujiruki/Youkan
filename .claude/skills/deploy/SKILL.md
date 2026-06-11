---
name: deploy
description: Youkan を検証付きで本番（ConoHa WING）へデプロイする。テスト → ビルド → upload.ps1 → 本番確認 の標準手順。
---

# Youkan 本番デプロイ手順

Youkan（C:\Fujiruki\Projects\Youkan）を ConoHa WING の本番環境 `https://door-fujita.com/contents/Youkan/` へデプロイします。以下の手順を順番に実行してください。途中で失敗したら**その時点で停止**し、原因を報告すること。

## 前提チェック

1. 作業ディレクトリがプロジェクトルートであること: `git rev-parse --show-toplevel` → `C:/Fujiruki/Projects/Youkan`
2. ブランチが `master` で、デプロイしたい変更がマージ済みであること: `git branch --show-current` / `git status --short`（未コミット変更があれば内容を確認し、デプロイに含めるべきか判断）

## 手順

### 1. テスト（全 green 必須）

```bash
cd JWCADTategu.Web && npm.cmd run test -- --run
```

- Windows のため `npm` ではなく **`npm.cmd`** を使う
- failed が 1 件でもあればデプロイ中止
- `vitest` が見つからない場合は `node_modules` が空になっている可能性 → `npm.cmd install` 後に再実行

### 2. 本番ビルド

```bash
cd JWCADTategu.Web && npm.cmd run build
```

- `✓ built in ...` を確認。出力は `JWCADTategu.Web/dist/`
- ビルド出力の末尾に `stone/` 等の無意味な文字列が付加されていないこと（Viteビルドエラーの原因）

### 3. デプロイ実行

```bash
cd /c/Fujiruki/Projects/Youkan && powershell.exe -File upload.ps1
```

- `DEPLOYMENT SUCCESSFUL!` を確認
- upload.ps1 は backend + dist を tar.gz にまとめ SSH でアップロード・展開する
- **`.env` / `*.sqlite` / `*.log` は upload.ps1 が除外する設計**（本番の OAuth 秘密鍵・DB を上書きしないため）。この除外設定を絶対に外さないこと
- 権限拒否された場合: ユーザーに `! powershell -File upload.ps1` での手動実行を依頼する

### 4. 本番検証（chrome-devtools MCP）

1. `https://door-fujita.com/contents/Youkan/` を **ignoreCache: true** でリロード（古いチャンクのキャッシュ対策）
2. 未ログインの場合: fjt.suntree@gmail.com / aaaa でログイン
3. 今回の変更に該当する画面を操作し、期待どおり動くことを確認
4. console にエラーが出ていないか `list_console_messages` で確認

### 5. 記録

- 検証で問題なければ `docs/request_log.md` の該当 R 番号の対応状況を「完了（YYYY-MM-DDデプロイ済み）」に更新してコミット

## 注意事項

- 本番 DB（SQLite）はサーバー側にのみ存在する。ローカルの DB を上書きアップロードしない
- 検証でテストデータ（アイテム等）を作成した場合は必ず削除して原状回復する
- デプロイ対象は master のみ。feature ブランチからの直接デプロイ禁止
