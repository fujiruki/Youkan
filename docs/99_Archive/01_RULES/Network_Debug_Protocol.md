# Network Debug Protocol (NDP)
ネットワーク関連エラーの効率的デバッグ手順

## Phase 1: 症状の特定（1分）
1. **エラーメッセージの確認**
   ```
   - ブラウザコンソール: 500? 404? CORS?
   - Viteログ: ECONNREFUSED? Proxy error?
   - PHPログ: Fatal error? Warning?
   ```

2. **影響範囲の特定**
   ```powershell
   # 全エ��ドポイントが失敗？ 特定のエンドポイントのみ？
   curl http://localhost:8000/items    # Backend直接
   curl http://localhost:5173/api/items # Viteプロキシ経由
   ```

---

## Phase 2: 切り分け（3分）

### ステップA: バックエンド単体確認
```powershell
# PHPサーバー
curl -v http://localhost:8000/items 2>&1 | Select-String "HTTP"
# ✅ 200 OK → バックエンド正常
# ❌ 500/404 → バックエンド問題（PHP/DB確認）
```

### ステップB: プロキシ確認
```powershell
# Viteログ確認
# "ECONNREFUSED" → 接続失敗（最も一般的）
# "500" → バックエンドエラー
```

### ステップC: リスニングアドレス確認
```powershell
netstat -ano | findstr :8000
# [::1]:8000  → IPv6のみ（問題の可能性大）
# 127.0.0.1:8000 → IPv4のみ
# 0.0.0.0:8000 → 両対応（理想）
```

---

## Phase 3: 解決（即座）

### パターン1: ECONNREFUSED + IPv6リスニング
**症状:** Vite→`ECONNREFUSED 127.0.0.1:8000`、netstat→`[::1]:8000`  
**原因:** IPv4/IPv6ミスマッチ  
**解決:**
```powershell
# PHPサーバー再起動
php -S 0.0.0.0:8000 -t backend
```

### パターン2: バックエンド500エラー
**症状:** curl直接→500  
**原因:** PHPコード/DB問題  
**解決:**
```powershell
# エラー詳細取得
Invoke-WebRequest -Uri "http://localhost:8000/items" -UseBasicParsing | Select-Object Content
```

### パターン3: 重複プロセス
**症状:** ポートが占有されている  
**解決:**
```powershell
Get-Process | Where-Object {$_.ProcessName -eq "node"} | Stop-Process -Force
```

---

## Phase 4: 予防（初回セットアップ時）

### 1. package.jsonスクリプト統一
```json
{
  "scripts": {
    "dev": "vite",
    "dev:backend": "php -S 0.0.0.0:8000 -t backend",
    "dev:all": "concurrently \"npm run dev\" \"npm run dev:backend\""
  }
}
```

### 2. ヘルスチェックエンドポイント
`backend/health.php`:
```php
<?php
header('Content-Type: application/json');
echo json_encode([
    'status' => 'ok',
    'server' => $_SERVER['SERVER_ADDR'] ?? 'unknown',
    'port' => $_SERVER['SERVER_PORT'] ?? 'unknown'
]);
```

### 3. 起動時診断
```powershell
# backend/start.ps1
Write-Host "Starting PHP server on 0.0.0.0:8000..."
php -S 0.0.0.0:8000 -t backend
```

---

## Quick Reference

| 症状 | コマンド | 期待結果 |
|------|---------|----------|
| API 500エラー | `curl localhost:8000/items` | 200 OK or エラー詳細 |
| ECONNREFUSED | `netstat -ano \| findstr :8000` | 0.0.0.0:8000 |
| ポート競合 | `Get-Process \| Where ProcessName -eq "node"` | 1プロセスのみ |

---

**重要:** WindowsでPHPサーバーを起動する際は、必ず`0.0.0.0`を使用すること。
