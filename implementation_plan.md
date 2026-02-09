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
