# プロジェクト設定 (Project Configuration)

このファイルは、AIがこのプロジェクトで開発・検証を行う際に参照する、プロジェクト固有の設定情報を定義します。

---

## 1. 開発サーバー設定

### 1.1 ポート番号
```
PORT: 5173
```
- **フレームワーク**: Vite
- **デフォルトポート**: 5173
- **代替ポート**: 5174, 5175 (自動フォールバック)

### 1.2 アプリケーションディレクトリ
```
APP_ROOT: ./JWCADTategu.Web
```
- **package.json の場所**: `./JWCADTategu.Web/package.json`
- **src ディレクトリ**: `./JWCADTategu.Web/src`

### 1.3 起動コマンド
```
START_COMMAND: dev
FULL_COMMAND: npm.cmd run dev
```

### 1.4 起動確認
```
SUCCESS_MESSAGE_PATTERN: "VITE v.*ready"
WAIT_TIME: 8000ms
```

---

## 2. ブラウザアクセス

### 2.1 開発サーバーURL
```
LOCAL_URL: http://localhost:5173/
NETWORK_URL: (use --host フラグで公開時のみ)
```

### 2.2 主要ページパス
```
HOME: /
PROJECTS: /
EDITOR: /editor/:doorId
SCHEDULE: /schedule/:projectId
```

---

## 3. ビルド設定

### 3.1 本番ビルド
```
BUILD_COMMAND: npm.cmd run build
BUILD_OUTPUT: ./JWCADTategu.Web/dist
BUILD_TIME: ~30秒
```

### 3.2 ビルド確認
```
SUCCESS_INDICATOR: Exit code: 0
OUTPUT_FILE_CHECK: ./JWCADTategu.Web/dist/index.html
```

---

## 4. デプロイ設定

### 4.1 デプロイ先
```
DEPLOY_SCRIPT: upload.bat
DEPLOY_TARGET: GitHub Pages
BASE_PATH: /TateguDesignStudio/
```

### 4.2 デプロイ手順
1. `npm.cmd run build` (ビルド)
2. ビルド完了確認 (Exit code: 0)
3. `upload.bat` 実行

---

## 5. テスト設定

### 5.1 テストコマンド
```
TEST_COMMAND: npm.cmd run test
WATCH_MODE: npm.cmd run test:watch
```

### 5.2 カバレッジ
```
COVERAGE_COMMAND: npm.cmd run test:coverage
COVERAGE_OUTPUT: ./JWCADTategu.Web/coverage
```

---

## 6. データベース

### 6.1 種類
```
DB_TYPE: IndexedDB (Dexie.js)
DB_NAME: JWCADTateguDB
```

### 6.2 テーブル
```
TABLES:
  - projects
  - doors
```

---

## 7. 環境変数 (将来使用予定)

### 7.1 開発環境
```
NODE_ENV: development
VITE_APP_TITLE: Tategu Design Studio
```

### 7.2 本番環境
```
NODE_ENV: production
VITE_BASE_URL: /TateguDesignStudio/
```

---

## 8. AI開発での注意事項

### 8.1 コマンド実行
- ✅ **使用**: `npm.cmd` (PowerShell対策)
- ❌ **禁止**: `npm` (実行ポリシーエラー)

### 8.2 パス指定
- ✅ **推奨**: 絶対パス
- ⚠️ **相対パス**: プロジェクトルートからの相対パスを明示

### 8.3 サーバー起動時の待機時間
```
最小待機時間: 8000ms
推奨待機時間: 10000ms (安全マージン含む)
```

---

**最終更新**: 2026-01-05  
**プロジェクト**: Tategu Design Studio  
**フレームワーク**: React + Vite + TypeScript
