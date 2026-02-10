# 修正計画：量感カレンダーのデバッグと再発防止

## 目標
量感カレンダーの不具合（クリック連動、リセット機能）を修正しつつ、リファクタリングによって簡略化されてしまった**リッチなデザインを完全に復元**する。

## ユーザー確認事項
> [!IMPORTANT]
> リファクタリングによって、グリッドの質感、SVG曲線の詳細な描画、アニメーション、ガントビューなどのデザイン要素が一時的に失われています。これらを以前の状態に戻し、かつバグ修正（イベントバブリング防止）を適用した状態に再構築します。

## 変更内容
以前の `RyokanCalendar.tsx` (964行) から、各デザインパラメーターとコンポーネント構造を分割後のファイルに再移植します。

### カレンダーコンポーネントの再構築
#### [MODIFY] [RyokanGridView.tsx](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/features/core/jbwos/components/Calendar/RyokanGridView.tsx)
- `gap-px` とセルの枠線演出を復元。
- 背景のボリューム曲線（VolumeCurve）のパス計算ロジックを以前の仕様に戻す。

#### [MODIFY] [CalendarCell.tsx](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/features/core/jbwos/components/Calendar/CalendarCell.tsx)
- ホバーエフェクトと intensity オーバーレイのスタイルを以前の豪華なものに復元。
- イベント伝播の停止 (`stopPropagation`) を維持。

#### [MODIFY] [RyokanCalendar.tsx](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/features/core/jbwos/components/Calendar/RyokanCalendar.tsx)
- `framer-motion` を使用した指示線の曲線描画（Quadratic Bezier）とアニメーションを以前の状態に復元。
- ガントビュー (`RyokanGanttView`) を復帰させる。
した際の詳細表示が確実に動作するよう、`onItemClick` の呼び出しを確認。
- **[VolumeCalendarScreen.tsx]**:
    - 量感カレンダー単体画面での「アイテムクリック」が反応していなかったため、`selectedItem` ステートと `DecisionDetailModal` を正しく統合し、プロップを伝達します。

## 3. 「Aを作るとBが消える」現象への対策
大規模なファイルを一度に改変することで発生する「回帰バグ」を防ぐため、以下の運用を試験的に導入します。

> [!IMPORTANT]
> **再発防止策 (Flashモデル向け)**:
> 1. **コンポーネントの細分化**: `RyokanCalendar.tsx`（約1000行）を `RyokanGrid`, `RyokanTimeline`, `CalendarCell` 等に分割し、AIが把握すべきコンテキストを最小化します。
> 2. **自動回帰テストの実施**: 変更後にブラウザサブエージェントを使い、「指示線の表示」「ダブルクリックで一覧表示」「詳細モーダル表示」の3点を必ず自動チェックさせます。
> 3. **変更点のみの最小編集**: 可能な限り `multi_replace_file_content` を使い、周辺ロジックへの影響を最小限に留めます。

## 4. 実行手順
1. `RyokanCalendar.tsx` のバブリング問題を修正。
2. `VolumeCalendarScreen.tsx` に詳細表示ロジックを統合。
3. ブラウザサブエージェントによる自動検証（上記3点）。
4. (オプション) 今後の保守性向上のため、コンポーネントの分割リファクタリングを実施。

承認をいただければ、修正に着手します。

## 6. 量感カレンダーの表示・配分ロジックの整合性 (2026-02-11)
ユーザーフィードバックに基づき、表示（UI）と負荷配分（Engine）の起点を明確に分離し、整合性を取ります。

### ロジック定義
| 機能 | 第一優先 | 第二優先 (フォールバック) |
| :--- | :--- | :--- |
| **カード表示日 (UI)** | `due_date` (納期) | `prep_date` (マイ期日) |
| **配分計算起点 (Engine)** | `prep_date` (マイ期日) | `due_date` (納期) |

### [MODIFY] [QuantityEngine.ts](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/features/core/jbwos/logic/QuantityEngine.ts)
- **配分起点**: `prep_date` を優先し、なければ `due_date` を使用して遡り計算を開始。
- **エンゲージメント登録**: 稼働時間が 0 の日（休日等）であっても、計算の起点日には必ず `contributorsMap` にアイテムを登録し、UI上で Chip が表示されるようにする。

### [MODIFY] [CalendarCell.tsx](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/features/core/jbwos/components/Calendar/CalendarCell.tsx)
- **表示条件**: `due_date` があればその日のみ、なければ `prep_date` の日に表示するようフィルタを厳格化。
- **省略記号**: 4件目以降がある場合、`+N` バッジに加えてドット記号 `...` を表示し、隠れアイテムの存在を明示。
- **属性付与**: `data-date` 属性を付与（継続）。

### [MODIFY] [RyokanCalendar.tsx](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/features/core/jbwos/components/Calendar/RyokanCalendar.tsx)
- **多層ガイド**: Chip -> セル -> 画面端 の順でターゲットを判定するロジックを実装。

### 検証計画 (TDD)
- 納期とマイ期日が異なるアイテムを作成し、期待通りのセルに Chip が出るか確認。
- 1/31（休日）をマイ期日に設定し、1/31 に Chip が表示され 1/28 に負荷が出ることを確認。
- 1/28 をクリックし、1/31 の Chip またはセルへ線が引かれることを確認。

## 5. 指示線UXの改善 (画面外対応)
ユーザーフィードバック「B案：画面端への方向指示」に基づき実装します。

### [MODIFY] [RyokanCalendar.tsx](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/features/core/jbwos/components/Calendar/RyokanCalendar.tsx)
- `handleDayAction` 内の座標計算ロジックを拡張。
- `document.getElementById` が null を返した場合：
  - アイテムの期日と現在表示しているカレンダーの範囲（`allDays` の最初と最後）を比較。
  - 過去なら左端 (`x=0`)、未来なら右端 (`x=clientWidth`) をターゲット座標とする。
  - `PressureConnection` に `isOffScreen: 'left' | 'right'` フラグを追加し、描画側でスタイル（破線など）を変える。

### [MODIFY] [CalendarCell.tsx](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/features/core/jbwos/components/Calendar/CalendarCell.tsx)
- セルの root `div` に `data-date={date.toDateString()}` を付与。
- アイテムが省略された際の表示 (`+N`) を、より明示的な記号（例: `...` や特定アイコン付きのバッジ）にアップグレード。

### [MODIFY] [RyokanCalendar.tsx](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/features/core/jbwos/components/Calendar/RyokanCalendar.tsx)
- `handleDayAction` を改修。
- 指示線の到達地点を決定するロジック（優先順位）：
    1. **具体的Chip**: `cal-chip-${item.id}` があればその中心。
    2. **表示セル**: Chip がなくても、そのアイテムが表示されるべき日（納期、なければマイ期限）のセル `[data-date="${targetDate}"]` があればその中心。
    3. **画面外方向**: セルも画面内になければ、前回実装の画面端ガイド。

### 検証計画
- 省略記号が表示され、そこに向かって（正確にはセルに向かって）線が引かれることを確認。
- 納期がないアイテムがマイ期限のセルを正しく指すことを確認。
