# Youkan 仕様書マップ (SPEC.md)

## プロジェクト概要

Youkan（羊羹）は「Judgment-Free Work-life Operating System」。
判断疲れを極限まで減らし、タスク管理・スケジュール管理・進捗管理を通じて「精神的充足」を提供するシステム。

---

## 仕様書一覧

### コア仕様書（`spec/`）

| # | ファイル | 概要 | 最終更新 |
|:--|:--|:--|:--|
| 01 | [概要](spec/01_概要.md) | 何を作るか・誰のためか・解決する課題 | 2026-03-24 |
| 02 | [機能仕様](spec/02_機能仕様.md) | 機能一覧と各機能の詳細仕様 | 2026-03-24 |
| 03 | [画面設計](spec/03_画面設計.md) | 画面構成・View定義・モーダル | 2026-03-24 |
| 04 | [データ設計](spec/04_データ設計.md) | DB設計・状態定義・API設計 | 2026-03-24 |
| 05 | [技術設計](spec/05_技術設計.md) | 技術スタック・アーキテクチャ | 2026-03-24 |
| 06 | [変更履歴](spec/06_変更履歴.md) | 仕様変更の経緯と理由 | 2026-03-24 |

### 旧仕様書（参照用）

| ファイル | 概要 | 備考 |
|:--|:--|:--|
| [spec/00_MASTER_SPEC.md](spec/00_MASTER_SPEC.md) | 旧JBWOS統合定義書 v3.4 | SdDD導入前の「憲法」。内容は新spec/*.mdに統合済み |
| [spec/01_STATE_MATRIX.md](spec/01_STATE_MATRIX.md) | 旧アイテム状態定義表 | 04_データ設計.mdに統合済み |
| [spec/02_VIEW_DEFINITIONS.md](spec/02_VIEW_DEFINITIONS.md) | 旧画面・表示仕様 | 03_画面設計.mdに統合済み |
| [spec/03_MORNING_PLANNING.md](spec/03_MORNING_PLANNING.md) | 朝の段取りビュー仕様 | 02_機能仕様.mdに統合済み |
| [SPEC/](SPEC/) | 大文字SPECディレクトリ | spec/と同内容。spec/を正とする |

### 要望管理

| ファイル | 役割 |
|:--|:--|
| [requests.md](requests.md) | 未対応の要望一覧 |
| [request_log.md](request_log.md) | 全リクエストの対応履歴 |

### 設計参照資料（`00_Vision/`）

| ファイル | 内容 |
|:--|:--|
| [00_Vision/System_Grand_Design.md](00_Vision/System_Grand_Design.md) | グランドデザイン（3層構造・マルチテナント） |
| [00_Vision/SYSTEM_PHILOSOPHY_AND_VISION.md](00_Vision/SYSTEM_PHILOSOPHY_AND_VISION.md) | 思想と全体像（アカウントモデル・フィルタ定義） |
| [00_Vision/JBWOS_TERMINOLOGY_DICTIONARY.md](00_Vision/JBWOS_TERMINOLOGY_DICTIONARY.md) | 用語辞典 |
| [00_Vision/Capacity_Management_Spec.md](00_Vision/Capacity_Management_Spec.md) | キャパシティ管理仕様 |
| [00_Vision/User_Voices/](00_Vision/User_Voices/) | 晴樹の要望・仕様議論の記録 |

---

## 現在地

- **フロントエンド**: React + TypeScript + Vite + Tailwind CSS で実装済み
- **バックエンド**: PHP + SQLite で実装済み
- **実装済み機能**: Stream View、Panorama View、Newspaper View、量感カレンダー、詳細モーダル、ドラッグ&ドロップ並べ替え（Morning Planning）、マルチテナント、プロジェクト管理、プラグインシステム（建具）
- **認証**: JWT認証（個人アカウント・会社アカウント）

---

## ディレクトリ構成

```
Youkan/
├── JWCADTategu.Web/     # フロントエンド（React + Vite）
│   └── src/
│       ├── features/core/youkan/   # Youkanコア機能
│       ├── features/plugins/       # プラグイン（建具・顧客・製造）
│       └── ...
├── backend/              # バックエンド（PHP + SQLite）
│   ├── ItemController.php
│   ├── TodayController.php
│   ├── CalendarController.php
│   └── ...
├── docs/                 # 仕様書群
│   ├── SPEC.md           # ← このファイル（目次）
│   ├── spec/             # コア仕様書
│   ├── requests.md       # 未対応要望
│   ├── request_log.md    # 対応履歴
│   └── 00_Vision/        # 設計思想・参照資料
└── ...
```
