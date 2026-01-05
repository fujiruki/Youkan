# ブラウザ検証 クイックリファレンス

このドキュメントは、AI自身がブラウザ検証を実施する際の手順を簡潔にまとめたものです。

---

## 📋 検証フロー

### ステップ1: サーバー状態確認

```powershell
netstat -ano | findstr ":5173"
```

**判定**:
- ✅ 出力あり → **ステップ3へ**
- ❌ 出力なし → **ステップ2へ**

---

### ステップ2: サーバー起動

**コマンド**:
```powershell
Cwd: c:\Users\doorf\OneDrive\ドキュメント\プロジェクト\TateguDesignStudio\JWCADTategu.Web
CommandLine: npm.cmd run dev
WaitMsBeforeAsync: 8000
```

**成功確認**:
```
VITE v5.x.x ready in xxxx ms
➜  Local:   http://localhost:5173/
```

⚠️ **注意**: `npm` ではなく `npm.cmd` を使用（PowerShell実行ポリシー対策）

---

### ステップ3: ブラウザサブエージェント起動

**パラメータ**:
- TaskName: 検証内容を端的に（例: "Verify Settings Modal"）
- RecordingName: スネークケースで（例: "verify_settings_modal"）
- Task: 具体的な手順を箇条書き（10ステップ以内）

**URL**: `http://localhost:5173/`

---

### ステップ4: 検証結果の記録

**成功時**:
1. taskdmd を更新（該当タスクを `[x]` に）
2. walkthrough.md を更新
3. スクリーンショットを埋め込み

**失敗時**:
1. エラー内容を分析
2. 修正を実施
3. 再検証

---

## 🔧 よくあるエラーと対処法

### エラー1: PSSecurityException
```
npm : ファイル ... を読み込めません
```
**対処**: `npm` → `npm.cmd`

### エラー2: ERR_CONNECTION_REFUSED
```
net::ERR_CONNECTION_REFUSED
```
**対処**: サーバー未起動 → ステップ2を実行

### エラー3: Port already in use
```
Port 5173 is busy
```
**対処**: 既に起動済み → そのまま検証可能

---

## ✅ チェックリスト

実行前に確認：
- [ ] `npm.cmd` を使用している（`npm` ではない）
- [ ] WaitMsBeforeAsync ≥ 8000ms を設定
- [ ] ブラウザタスクに具体的な手順を記載
- [ ] RecordingName が明確で簡潔

---

**最終更新**: 2026-01-05
