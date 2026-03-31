# Youkan

Youkan（羊羹）は「Judgment-Free Work-life Operating System」。
判断疲れを極限まで減らし、タスク管理・スケジュール管理・進捗管理で「精神的充足」を提供する。

---

## 開発方式: 仕様書駆動開発（SdDD）

**`docs/sddd/rules.md` を必ず読むこと。** SdDDの全ルール（役割定義・ワークフロー・Agent運用・禁止事項）が記載されている。

---

## システム概要

建具屋（木工所）の業務を見積もりから製造・納品まで一気通貫で管理するOS。
個人の生活タスクと業務タスクを統合し、「量感（キャパシティ）」で直感的に把握できる。
マルチテナント対応（個人アカウント・会社アカウント分離）。

## 技術スタック

- **フロントエンド**: React + TypeScript + Vite + Tailwind CSS
- **バックエンド**: PHP 8（Built-in Server）+ SQLite3
- **認証**: JWT（個人アカウント・会社アカウント）
- **デプロイ**: `upload.ps1` → ConoHa WING（SSH）

## 開発サーバー起動

```bash
# フロントエンド
cd JWCADTategu.Web && npm.cmd run dev
# → http://localhost:5173/contents/Youkan/

# バックエンド
php -S localhost:8000 -t backend backend/router.php
```

Windows環境のため `npm` ではなく `npm.cmd` を使うこと。

## コーディングルール

- 全コメント・ドキュメント・コミットメッセージは日本語
- MVVMパターン: View（React JSX）→ ViewModel（カスタムフック）→ Model（ビジネスロジック）
- フロント: camelCase / バック: snake_case（Repository層で変換）
- テスト駆動開発（TDD）: テストファースト必須
- 命名規約の詳細: `docs/reference/naming_convention.md`

## 主要ファイルマップ

```
Youkan/
├── JWCADTategu.Web/         # フロントエンド
│   └── src/
│       ├── features/core/youkan/   # Youkanコア機能
│       ├── features/plugins/       # プラグイン（建具・顧客・製造）
│       └── shared/                 # 共通コンポーネント
├── backend/                  # バックエンド（PHP + SQLite）
│   ├── ItemController.php
│   ├── TodayController.php
│   ├── CalendarController.php
│   ├── GdbController.php
│   ├── BaseController.php    # 共通マッピング・認証
│   └── db.php                # DB接続
├── docs/                     # 仕様書群
│   ├── SPEC.md               # 仕様書目次
│   ├── spec/                 # SdDD仕様書（01〜06）
│   ├── sddd/rules.md         # SdDDルール
│   ├── requests.md           # 未対応要望
│   ├── request_log.md        # 対応履歴
│   ├── handover/             # Agent引き継ぎ
│   └── reference/            # 参照資料（ビジョン・判例・命名規約）
├── upload.ps1                # デプロイスクリプト
└── task.md                   # 現在のタスク進捗
```

## テスト

```bash
# フロントエンド（Vitest）
cd JWCADTategu.Web && npm.cmd run test -- --run
```
