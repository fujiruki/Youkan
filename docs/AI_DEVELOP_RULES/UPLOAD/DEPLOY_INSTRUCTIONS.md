# Webアプリケーション デプロイ手順書 (AIアシスタント向け)

このドキュメントは、ユーザーのWebサーバー (ConoHa) にWebアプリケーション (Vite/React/静的サイト) をデプロイするための手順を記したものです。

## 1. 前提条件

デプロイを実行するために、AIエージェントは以下にアクセス可能である必要があります：

1.  **ソースコード**: Webアプリケーションのプロジェクト (package.json に `build` スクリプトが含まれていること)。
2.  **デプロイスクリプト**: `upload.ps1` (同じフォルダに配置)。
3.  **SSH秘密鍵**: 鍵ファイル `key-2025-11-29-07-10.pem` が `docs/AI_DEVELOP_RULES/UPLOAD/` に存在すること。

## 2. デプロイのワークフロー

### ステップ1: プロジェクトの準備

1. プロジェクトルートに `docs/AI_DEVELOP_RULES/UPLOAD/` フォルダを作成
2. このフォルダに以下をコピー：
   - `upload.ps1`（デプロイスクリプト）
   - `key-2025-11-29-07-10.pem`（SSH秘密鍵）
   - `DEPLOY_INSTRUCTIONS.md`（この手順書、オプション）

### ステップ2: スクリプトの設定

`upload.ps1` を開き、以下の変数を編集します：

```powershell
# 🎯 重要: デプロイ先のディレクトリを指定
$remoteDir = "public_html/door-fujita.com/contents/YOUR_PROJECT_NAME"  # <-- 変更

# フロントエンドのディレクトリ名
$frontendDir = "JWCADTategu.Web"  # <-- プロジェクト構造に合わせて変更

# バックエンドのディレクトリ名（存在しない場合は自動スキップ）
$backendDir = "backend"  # <-- 必要に応じて変更
```

### ステップ3: デプロイ実行

プロジェクトルートで以下を実行：

```powershell
.\docs\AI_DEVELOP_RULES\UPLOAD\upload.ps1
```

または、プロジェクトルートにスクリプトをコピーして：

```powershell
.\upload.ps1
```

## 3. スクリプトが実行する処理

デプロイスクリプトは以下を自動実行します：

1. **[1/4] フロントエンドのビルド**
   - `npm run build` を実行
   - `dist` フォルダを生成

2. **[2/4] デプロイパッケージの準備**
   - バックエンドファイル（PHP, .htaccess）をコピー（存在する場合）
   - フロントエンドアセット（dist/*）をコピー
   - 一時フォルダ `deploy_tmp` で統合

3. **[3/4] アーカイブ作成**
   - `deploy.tar.gz` を作成
   - 一時フォルダを削除

4. **[4/4] サーバーへのアップロード＆展開**
   - SSH/SCP でサーバーにアップロード
   - サーバー上で展開
   - パーミッション設定（dirs: 755, files: 644）
   - アーカイブファイルを削除

## 4. トラブルシューティング

### ビルドエラー

```
Frontend build failed with exit code 1
```

**原因**: `npm run build` が失敗
**対処**: 
- `package.json` に `build` スクリプトが定義されているか確認
- ローカルで `npm run build` を実行してエラーを確認

### SSH接続エラー

```
SSH mkdir failed
```

**原因**: SSH鍵のパスが間違っているか、サーバーに接続できない
**対処**:
- `$sshKeyPath` が正しいか確認
- 鍵ファイルが存在するか確認
- サーバー情報（$serverHost, $serverUser, $serverPort）が正しいか確認

### ディレクトリが見つからない

```
Frontend directory 'XXX' not found
```

**原因**: `$frontendDir` の設定が間違っている
**対処**: プロジェクト構造に合わせて `$frontendDir` を修正

## 5. サーバー設定情報

- **ホスト**: www1045.conoha.ne.jp
- **ユーザー**: c6924945
- **ポート**: 8022
- **ベースURL**: http://door-fujita.com/contents/

デプロイ後のURLは：
```
http://door-fujita.com/contents/[プロジェクト名]/
```

## 6. セキュリティ注意事項

- SSH秘密鍵（.pem ファイル）は**絶対にGitにコミットしない**
- `.gitignore` に `*.pem` を追加すること
- 鍵ファイルのパーミッションは 600 に設定すること（Linux/Mac の場合）

## 7. 他のプロジェクトへの適用

このスクリプトは汎用テンプレートとして設計されています。
新しいプロジェクトで使用する場合：

1. `docs/AI_DEVELOP_RULES/UPLOAD/` フォルダ全体をコピー
2. `upload.ps1` の設定セクション（上部）を編集
3. プロジェクト構造に合わせて変数を調整
4. 実行

スクリプトは自動的に：
- バックエンドの有無を判定
- フロントエンドをビルド
- 統合パッケージを作成
- デプロイ

を行います。
