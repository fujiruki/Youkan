# Development Environment Best Practices
開発環境構築と運用のベストプラクティス

## 🎯 このドキュメントの目的
フロントエンド（Vite/React）+ バックエンド（PHP）構成のプロジェクトにおいて、効率的かつトラブルの少ない開発環境を構築・維持するための指針。

---

## 1. サーバー起動の標準化

### ❌ 問題の例
```powershell
# IPv6/IPv4ミスマッチでViteプロキシ接続失敗
php -S localhost:8000 -t backend  # → ::1:8000 (IPv6)
```

### ✅ 推奨方法
```powershell
# 全インターフェースでリッスン（IPv4/IPv6両対応）
php -S 0.0.0.0:8000 -t backend
```

### 📦 起動スクリプトの準備
**準備するもの:**
- `backend/start-server.ps1`: ポート確認、DB確認、起動
- `package.json`: `dev:backend`スクリプト
- `backend/health.php`: ヘルスチェックエンドポイント

**利点:**
- 起動手順の一貫性
- トラブルシューティングの効率化
- 新規メンバーのオンボーディング簡素化

---

## 2. ヘルスチェックエンドポイント

### 目的
サーバー/DB状態を即座に確認できるエンドポイント

### 実装例
```php
// backend/health.php
<?php
header('Content-Type: application/json');
echo json_encode([
    'status' => 'ok',
    'server' => ['address' => $_SERVER['SERVER_ADDR']],
    'database' => ['exists' => file_exists('jbwos.sqlite')]
]);
```

### 使用法
```powershell
curl http://localhost:8000/health
```

**確認項目:**
- サーバーステータス
- データベース接続
- 必要な拡張機能（PDO, SQLiteなど）
- アイテム数など実データの確認

---

## 3. デバッグプロトコルの文書化

### 構成要素
1. **症状の特定** (1分)
   - エラーメッセージ確認
   - 影響範囲特定

2. **切り分け** (3分)
   - バックエンド単体確認: `curl localhost:8000/items`
   - プロキシ確認: Viteログ
   - リスニングアドレス: `netstat -ano | findstr :8000`

3. **解決** (即座)
   - パターン別の対処法
   - コマンド例

4. **予防** (初回セットアップ)
   - スクリプト準備
   - ドキュメント整備

### ドキュメント例
`docs/AI_DEVELOP_RULES/Network_Debug_Protocol.md`

---

## 4. 環境変数の管理

### 開発環境と本番環境の分離

**`.env.development`:**
```env
VITE_API_URL=http://localhost:8000
```

**`.env.production`:**
```env
VITE_API_URL=/api
```

**`vite.config.ts`:**
```typescript
proxy: {
  '/api': {
    target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000',
    changeOrigin: true
  }
}
```

---

## 5. プロセス管理

### 重複プロセスの防止
```powershell
# 起動前に既存プロセスを確認
Get-Process | Where-Object {$_.ProcessName -eq "node"}
netstat -ano | findstr :5173
```

### クリーンアップ
```powershell
# 全停止
Get-Process | Where-Object {$_.ProcessName -eq "node"} | Stop-Process -Force
```

---

## 6. Gitフックの活用（オプション）

### pre-commit
```bash
#!/bin/sh
# ビルドエラーチェック
npm run build
```

---

## 7. トラブルシューティングチェックリスト

問題が発生したら、以下を順番に確認：

- [ ] バックエンドサーバーは起動している？（`netstat -ano | findstr :8000`）
- [ ] ヘルスチェックは通る？（`curl localhost:8000/health`）
- [ ] Viteサーバーは起動している？（`netstat -ano | findstr :5173`）
- [ ] 重複プロセスはない？（`Get-Process | Where ProcessName -eq "node"`）
- [ ] Viteキャッシュは削除した？（`Remove-Item node_modules/.vite -Recurse`）
- [ ] プロキシ設定は正しい？（`vite.config.ts`確認）
- [ ] IPv4/IPv6は一致している？（PHPは`0.0.0.0`で起動）

---

## 8. まとめ

### 準備すべきファイル
1. `backend/start-server.ps1` - サーバー起動スクリプト
2. `backend/health.php` - ヘルスチェック
3. `docs/AI_DEVELOP_RULES/Network_Debug_Protocol.md` - デバッグ手順
4. `.env.development` / `.env.production` - 環境変数

### 原則
- **一貫性**: スクリプトで起動手順を統一
- **可視性**: ヘルスチェックで状態を常時確認可能に
- **文書化**: トラブル時の手順を明文化
- **自動化**: 繰り返し作業はスクリプト化

これらを初回セットアップ時に準備することで、長期的な開発効率とメンテナンス性が大幅に向上します。
