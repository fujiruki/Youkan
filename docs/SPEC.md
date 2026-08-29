# Youkan 仕様書マップ (SPEC.md)

## プロジェクト概要

Youkan（羊羹）は「Judgment-Free Work-life Operating System」。
判断疲れを極限まで減らし、タスク管理・スケジュール管理・進捗管理を通じて「精神的充足」を提供するシステム。

---

## 仕様書一覧（`spec/`）

| # | ファイル | 概要 | 最終更新 |
|:--|:--|:--|:--|
| 01 | [概要](spec/01_概要.md) | 何を作るか・誰のためか・解決する課題 | 2026-03-24 |
| 02 | [機能仕様](spec/02_機能仕様.md) | 機能一覧と各機能の詳細仕様 | 2026-06-15 |
| 03 | [画面設計](spec/03_画面設計.md) | 画面構成・View定義・モーダル | 2026-06-15 |
| 04 | [データ設計](spec/04_データ設計.md) | DB設計・状態定義・API設計 | 2026-03-24 |
| 05 | [技術設計](spec/05_技術設計.md) | 技術スタック・アーキテクチャ | 2026-03-24 |
| 06 | [変更履歴](spec/06_変更履歴.md) | 仕様変更の経緯と理由 | 2026-06-15 |
| 07 | [Beaver連携](spec/07_Beaver連携.md) | Beaver案件の受け口・未配置負荷・容量シミュレーション（Y1、R-153） | 2026-08-25 |
| - | [capacity-check API契約](spec/R-153_capacity_check_api_contract.md) | Beaver B2向けに公開する容量判定API契約（Y1成果物） | 2026-08-25 |
| 08 | [Beaver連携Y2](spec/08_Beaver連携Y2.md) | work_packagesの段階分解・再帰的effective_total計算・missing_upstream規則（Y2、R-154） | 2026-08-27 |
| 09 | [全体一覧ドラッグでプロジェクト移動](spec/09_全体一覧ドラッグでプロジェクト移動.md) | 全体一覧でのDnDによる所属プロジェクト変更（R-155） | 2026-08-28 |
| 10 | [全体一覧Beaver連携バッジ](spec/10_全体一覧Beaver連携バッジ.md) | 全体一覧のheader行にBeaver連携を示す控えめな「B」バッジを表示（R-156） | 2026-08-28 |
| 11 | [全体一覧ドラッグ範囲拡大](spec/11_全体一覧ドラッグ範囲拡大.md) | 全体一覧D&Dのドロップ・ハイライト範囲をプロジェクトタイトル行＋配下コアアイテム行全体に拡大（R-157） | 2026-08-29 |

---

## 要望管理

| ファイル | 役割 |
|:--|:--|
| [requests.md](requests.md) | 未対応の要望一覧 |
| [requests_log.md](requests_log.md) | 全リクエストの対応履歴 |

---

## 開発ルール

| ファイル | 内容 |
|:--|:--|
| [../SDDD.md](../SDDD.md) | SdDD正本ルール（要望・仕様・タスクのライフサイクル） |
| [../CLAUDE.md](../CLAUDE.md) | Claude Codeアダプター（禁止事項・声かけ・スラッシュコマンド） |
| [collaboration.md](collaboration.md) | worktree分離・複数Agent運用 |
| [automation.md](automation.md) | ダッシュボード連携・Agent完了判定 |
| [AGENT_LOOP_ENGINEERING.md](AGENT_LOOP_ENGINEERING.md) | Agent loop engineering による進め方・検証・引き継ぎルール |

---

## 参照資料（`reference/`）

| ファイル | 内容 |
|:--|:--|
| [reference/vision/](reference/vision/) | グランドデザイン・用語辞典・思想 |
| [reference/decisions/](reference/decisions/) | AI会議判例集 |
| [reference/naming_convention.md](reference/naming_convention.md) | 命名規約 |
| [reference/user_voices_oral/](reference/user_voices_oral/) | 晴樹の口頭要望原文 |

---

## 現在地

- **フロントエンド**: React + TypeScript + Vite + Tailwind CSS で実装済み
- **バックエンド**: PHP + SQLite で実装済み
- **実装済み機能**: Stream View（登録と集中）、Panorama View（状況把握）、Newspaper View（全体一覧）、量感カレンダー、詳細モーダル、ドラッグ&ドロップ並べ替え（Morning Planning）、マルチテナント、プロジェクト管理、プラグインシステム（建具）
- **認証**: JWT認証（個人アカウント・会社アカウント）

---

## ディレクトリ構成

```
Youkan/
├── SDDD.md               # SdDD正本ルール
├── CLAUDE.md             # Claude Codeアダプター
├── JWCADTategu.Web/     # フロントエンド（React + Vite）
│   └── src/
│       ├── features/core/youkan/   # Youkanコア機能
│       ├── features/plugins/       # プラグイン（建具・顧客・製造）
│       └── ...
├── backend/              # バックエンド（PHP + SQLite）
├── docs/                 # 仕様書群
│   ├── SPEC.md           # ← このファイル（目次）
│   ├── SPEC/             # SdDD仕様書（01〜06）
│   ├── collaboration.md  # worktree分離・複数Agent運用
│   ├── automation.md     # ダッシュボード連携・Agent完了判定
│   ├── requests.md       # 未対応要望
│   ├── requests_log.md   # 対応履歴
│   ├── handover/         # Agent引き継ぎ
│   ├── reference/        # 参照資料
│   └── 99_Archive/       # 旧ドキュメント（SdDD導入前）
└── task.md               # 現在のタスク進捗
```
