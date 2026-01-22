# context_map (00_CONTEXT.md)
― TateguDesignStudio Project Map ―

> [!NOTE]
> このファイルはプロジェクトの「現在地」を示す地図である。
> AIモデルがリセットされた際、あるいは開発者が交代した際は、まずここを読むこと。

## 1. Project Identity
- **Name**: JBWOS (Joinery Basic Work OS) / Tategu Design Studio
- **Vision**: 建具屋（木工所）の業務を、見積もりから製造、納品まで一気通貫で管理・効率化するOS。
- **Core Value**: 「入力の心理的ハードルを下げる」「量感（キャパシティ）の直感的把握」「現場と経営の接続」

## 2. Tech Stack
- **Frontend**: React (Vite), TypeScript, Tailwind CSS
- **Backend**: PHP 8 (Built-in Server), SQLite3 (Direct File)
- **Environment**: Windows Local (Production-like), PowerShell

## 3. Directory Structure & Key Documents
全ドキュメントの詳細運用ルールは [01_RULES/DOCS_OPS.md](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/docs/01_RULES/DOCS_OPS.md) を参照。

- **`docs/`**
    - `01_RULES/`: **法典**。開発ルール、会議進行ルール (`AI_MEETING_WORKFLOW`)。
    - `10_ARCHITECTURE/`: **設計図**。DBスキーマ、システム構成図。
    - `20_DECISIONS/`: **判例集**。仕様変更の決定履歴 (AI会議ログ)。
        - 最新: [20260122_AuthModel.md](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/docs/20_DECISIONS/20260122_AuthModel.md) (権限モデルの刷新)
    - `30_MANUALS/`: **マニュアル**。
- **`src/`**
    - `features/`: 機能ごとに分割。各ディレクトリの `README` に詳細仕様あり。
        - `core/jbwos/`: プロジェクト管理、日報 (Life/Work Log)、認証。
        - `plugins/tategu/`: 建具専用機能（見積もり、３Dプレビュー、DXF生成）。

## 4. Current Status (Latest Phase)
**Phase 3: Execution & Life Persistence (Completed)**
- Project Registry, History画面の実装完了。
- ログ記録 (Life/Execution) の永続化完了。

**Phase 3.5: Security Hardening (In Progress)**
- 権限モデルの再実装中 (Inbox=Private, Project=Public)。
- APIレベルでのテナント分離・アクセス制御の強化。

## 5. Terminology (用語集)
- **Inbox**: どこのプロジェクトにも属さないタスク。個人の脳内。デフォルトPrivate。
- **Project**: 業務の単位。デフォルトPublic（テナント内共有）。
- **Life Log**: 個人の生活記録（食、寝、遊）。仕事ではないがキャパシティに影響するもの。
- **Execution Log**: 仕事の実行記録。
- **SVP (Smart Verification Protocol)**: 開発サーバー起動時の自己診断・修復スクリプト。

## 6. How to Start Development
1. `docs/00_CONTEXT.md` (これ) を読む。
2. `docs/01_RULES/AI_DEVELOPMENT_CONSTITUTION_*.md` を読む（「日本語で」「称賛しない」等の基本ルール）。
3. `verify_and_start.ps1` を実行して環境を起動する。
4. `task.md` で直近のタスクを確認する。

---
**Last Updated**: 2026-01-22
**Status**: Active
