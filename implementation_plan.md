# JBWOS Frozen v2 実装計画

## 目的
JBWOS Frozen v2 設計を厳格に実装する。
GDB（Global Decision Board）のレーン構成を `Judgment / Preparation / History` に再構築し、曖昧な計画を扱う「量感カレンダー」を実装する。また、UI用語や「やさしさ」の機能（今は無理・断る）を正しく実装する。

## ユーザーレビュー事項
> [!IMPORTANT]
> **厳格な遵守**: 指示通り、独自の「改善」や「最適化」は行いません。Frozen v2 に明記された機能のみを実装します。
> **レーン構造の変更**: 現在の GDB の `Hold` レーンは、v2 設計の `Judgment -> Preparation -> History` に合わせ、`Preparation`（備え）レーンへと移行・再構築されます。

## 変更内容

### 安全宣言 (Safety Declaration)
> [!IMPORTANT]
> **NOTE**:
> No server-side logic shall automatically promote items into Judgment or Today.
> All RDD, dates, and calendar data are advisory only and must not enforce decisions.
> (サーバーサイドロジックは、アイテムを自動的にJudgmentやTodayに昇格させてはならない。すべてのRDD、日付、カレンダーデータは助言情報に過ぎず、決定を強制してはならない。)

### フロントエンド (`JWCADTategu.Web`)

#### [MODIFY] [GlobalBoard.tsx](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/features/jbwos/components/GlobalBoard/GlobalBoard.tsx)
- **レーン再構築**:
    - `Hold` セクションを `Preparation`（備え）に名称変更およびリファクタリング。
    - 論理フローを `Judgment (Active)` -> `Preparation (Blurry)` -> `History (Log)` に統一。
- **UI文言の更新**:
    - ヘッダー等を v2 設計に完全一致させる（例：「今日の約束にするか」「備え（ぼやけ）」）。
- **操作**:
    - コンテキストメニューやアイテムカードに「今は無理」「断る」アクションを追加。

#### [NEW] [QuantityCalendar.tsx](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/features/jbwos/components/Calendar/QuantityCalendar.tsx)
- `量感カレンダー_UI_操作_ワイヤ_v2.md` に基づき「量感カレンダー」を実装。
- **機能**:
    - シームレスな縦スクロール。
    - 納期（確定）と備え完了目安（ぼやけ）の視覚的区別。
    - 「量感」（密度）の視覚化（モックまたは計算による密度表現）。
    - 備え完了目安のドラッグ＆ドロップ（ぼやけた日付の再設定）。

#### [MODIFY] [TodayScreen.tsx](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/features/jbwos/components/Today/TodayScreen.tsx)
- 「昨日の約束」確認（やさしい再開）ロジックが存在するか確認・修正（`例外_やさしい救済_v2.md` に準拠）。
- Zone 1/2/3 の用語が v2 設計と一致しているか確認。

### バックエンド (`backend`)

#### [MODIFY] [GdbController.php](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/backend/GdbController.php)
- **取得ロジックの更新**:
    - `getShelf()` は、`active`（判断対象）とは別に、`preparation`（備え・ぼやけ）アイテムを返却するように変更。
    - `active` の判定ロジックを修正：「判断が必要かもしれないアイテムを提示する（expose）」に留め、選択を強制しない（not enforce selection）。
    - ユーザーが自発的に判断プロセスを開始するための材料提供であり、自動的にJudgmentリストへ「送り込む」挙動ではないことを保証する。

#### [MODIFY] [ItemController.php](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/backend/ItemController.php)
- 「ぼやけた日付」（備え完了目安）のサポート追加。
    - **重要**: `prep_date`（備え目安日）を追加する場合、これは意味的に「弱い」型として扱う。
        - Nullable とする。
        - Index は作成しない（検索・ソートの強制力を弱める）。
        - バックエンドでの Validation（期限切れチェック等）は一切行わない。
    - `due_date`（納期・確定）とは明確に分離し、ロジック判断（アラート等）には決して使用しない。

## 検証計画

### 自動テスト
- **E2E戦略**: ブラウザツールを使用し、`E2Eテスト_確定シナリオ_v2.md` のシナリオをウォークスルー実行する。
    1. **シナリオ1（新規案件）**: 案件追加 -> Inbox/GDB表示確認 -> 備えへ移動 -> 量感カレンダーでの表示確認。
    2. **シナリオ5（断る）**: 案件作成 -> 「断る」選択 -> Historyへ移動確認（失敗ログなし）。
    3. **量感カレンダー**: 「確定」と「ぼやけ」の視覚的差異の確認。
    4. **観るだけ（Safety）**: 量感カレンダーを開き、Todayに何も入れずに閉じる -> 何も起きない（判断を求められない）。

### 手動検証
- **視覚確認**:
    - GDBの見た目が `GDB_全体ワイヤ_v2.md` と一致しているか。
    - 文言が「やさしい」か（「失敗」等の言葉がないか）。
- **ユーザーフロー**:
    - アイテムを「備え」に移動した際、ぼやけて表示されるか。
    - 「今は無理」を選択した際、罪悪感なく判断対象から消えるか。
