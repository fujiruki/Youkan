# ForNextAI (引き継ぎ資料)

## プロジェクト概要
**プロジェクト名**: TateguDesignStudio (Web版 建具設計積算アプリ)
**目的**: 建具店向けの設計・積算ツールをWebアプリとして再構築し、デザイン性と実用性を両立させる。
**ユーザー**: 建具店オーナー (50-60代)、将来的にDIYユーザー。

## システム構成
*   **Frontend**: React (Vite) + TypeScript
*   **Styling**: Tailwind CSS + clsx
*   **Database**: Dexie.js (IndexedDB wrapper) - ローカル保存重視
*   **Testing**: Vitest (Logic verification only)
*   **Language**: 日本語 (Hardcoded in UI/Labels)

## 現状の進捗 (Status)

### 1. UI/UX (Dual Phase Interface)
実装完了。`EditorScreen.tsx` にてモード切替を実装。
*   **Design Mode**: デザイン重視。スライダーによる直感的な操作（中桟、束、組子の本数変更）。
*   **Pro Mode**: 積算重視。詳細な数値入力（見付、ホゾ、余裕）、詳細積算グリッドの表示。
*   **Header**: モード切替スイッチ、リアルタイム金額表示。

### 2. 積算ロジック (Estimation Service)
実装完了・検証済み (`Verification` passed)。
*   **基本計算**: 幅・高・見込から、各部材の「木取り寸法」と体積(m3)を算出。
*   **安全率**: 余裕 (Margin) を設定可能 (Width +5mm, Length +50mm etc.)。
*   **ホゾ**: 框*2 (Double Tenon) や 束用ホゾ (30mm) を自動加算。
*   **新機能**: 組子 (Kumiko) の縦・横の本数と見付に対応。

### 3. データ構造
*   **DoorDimensions**: スキーマ定義済み (`src/domain/DoorDimensions.ts`)。Kumiko/Tsukaフィールド追加済み。
*   **Persistence**: `Dexie` (`src/db/db.ts`) により、Door/Project/Settings をブラウザ内に保存。

## 次に取り組むべきタスク (Immediate Next Steps)

### 1. JWCAD連携 (Priority: High)
**現状**: ダミーの「コピー」ボタンのみ。
**要件**: JWCADで貼り付け可能なテキスト形式 (`mg` コマンド等を含むクリップボード形式) を生成する。
**ヒント**:
*   `JWCADExporter.ts` にロジックを集約する。
*   座標データは `GeometryGenerator.ts` から取得できる。これをJWCADフォーマットに変換する。
*   Backend (Go server) が必要な場合、`cmd/server` を参照（ただし現在はWeb単体で動くことを目指しているため、Clipboard API (`navigator.clipboard`) で完結させるのが理想）。

### 2. 新規プロジェクト作成フロー
**現状**: `DashboardScreen` があるが、テンプレート選択などが未実装。
**要件**: プリセット（フラッシュ、障子、格子戸など）から新規作成できるウィザード画面。

### 3. バグ修正・調整
*   プレビュー上の「寸法線」表示（現在未実装）。
*   スライダー操作時のパフォーマンス（現状問題ないが、重くなればmemo化検討）。

## ファイル構成 (Handover Package)
このフォルダ (`TateguDesignStudio_Handover`) に以下のWeb版リソースを集約しました。
1.  **JWCADTategu.Web/**: ソースコード一式。
    *   `src/components/Editor/`: エディタ画面の主戦場。
    *   `src/domain/`: 積算ロジック。
2.  **docs/**: 仕様書・計画書。
    *   `docs/UI_UX_IMPROVEMENT_PLAN.md`: **必読**。UIデザインの意図が書かれている。
    *   `docs/ESTIMATION_LOGIC.md`: 積算計算式の正解。
    *   `docs/INDEX.md`: ドキュメント目次。

---
Good luck with the next phase! The core "Dual Phase" engine is solid. Focus on "Output" (JWCAD) next.
