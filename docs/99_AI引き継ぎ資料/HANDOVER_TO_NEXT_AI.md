# 🤖 HANDOVER TO NEXT AI (JBWOS Development)

**Date**: 2026-01-27
**Status**: Design Phase Complete / Ready for Implementation
**Author**: Previous AI Agent (Phase 13-17)

---

## 1. はじめに (Read First)

あなたは、**JBWOS (Julian's Best Work OS)** の実装を引き継ぐエンジニアです。
このシステムは、単なるタスク管理ツールではなく、**「判断疲れ」や「終わらない仕事の恐怖」からユーザー（藤田晴樹）を守るための『精神防衛OS』**です。

私が「思想」から「詳細設計」までを完璧に整えました。あなたの任務は、これを**一切の劣化なく実装すること**です。

---

## 2. 必須ドキュメント (Core Documentation)

実装前に以下の順で必ず読んでください。これらが全ての「正解」です。

1.  **[System_Grand_Design.md](../00_Vision/System_Grand_Design.md)**
    *   **内容**: システムの全体像、哲学、マルチテナント構造、製造業連携。
    *   **重要**: 「なぜこれを作るのか」が全て書いてあります。

2.  **[Screen_Flow_and_Wireframes.md](../01_User_Experience/Screen_Flow_and_Wireframes.md)**
    *   **内容**: 画面遷移、UI詳細（日本語文言）、インタラクション定義。
    *   **重要**: 「Not Today」ボタン、「キャパラインのフェードアウト」、「空色プログレスバー」など、細部まで規定されています。勝手に変更しないでください。

3.  **[Detailed_Design_and_Roadmap.md](../10_ARCHITECTURE/Detailed_Design_and_Roadmap.md)**
    *   **内容**: アーキテクチャ（MVVM/Clean Arch）、TDD戦略、具体的な実装タスクリスト。
    *   **重要**: あなたが最初に行うべき `Step 1` から `Step 4` までの作業手順書です。

---

## 3. 現状と次のアクション (Current State & Next Step)

### 現状 (As-Is)
*   **バックエンド**: 基本的なCRUDは動作中だが、`Focus Order` や `Intent` などの新カラムは未実装。
*   **フロントエンド**: 古い `TodayScreen` が残存。新しい `Dashboard` は未実装。
*   **認証**: マルチテナントログインは実装済みだが、Active Taskの永続化は未実装。

### 次のアクション (To-Be)
`Detailed_Design_and_Roadmap.md` の **Step 1: データベース移行とバックエンド** から着手してください。

1.  `migrate_v19_jbwos_core.php` を作成・実行し、DBスキーマを拡張する。
2.  バックエンドのControllerにソートロジック等を実装する。
3.  フロントエンドのUI実装に進む。

---

## 4. 開発の掟 (Golden Rules)

1.  **日本語UIの徹底**: 英語のかっこいいボタン名など不要です。「先送り」「完了」など、脳に負担のかからない日本語を使ってください。
2.  **Judgment Freeの実践**: ユーザーがタスクを溜め込んでも、赤字で警告しないでください。淡々と事実（キャパライン）だけを表示してください。
3.  **One Life Policy**: 個人タスクと会社タスクをデータ構造上は分けても、UI上は「一人の人間の時間」として統合して扱ってください。

---

## 5. 参照資料 (Context Logs)

*   [Expert Review Log](../meetings/20260127_AI_Expert_Review_Simulation.md): なぜこのデザインになったかの議論ログ（PM/UX/心理学）。
*   [Status Definition History](../00_Vision/Status_Definition_History.md): ステータス定義の変遷。

あなたの健闘を祈ります。Good luck.
