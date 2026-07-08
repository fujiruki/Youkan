# Agent Loop Engineering for Youkan

更新日: 2026-07-06

## 目的

Youkan の開発では、エージェントに都度細かく指示するのではなく、再利用できる作業ループを設計して進める。

この文書は、新しいセッションでも同じ進め方を再現するためのループ仕様である。

## 調査メモ

英語圏の最近の loop engineering / agentic loop の議論から、Youkan では次を採用する。

- ループ仕様は、trigger / goal / verification / stopping rule / memory を持つ再利用可能な作業単位とする。
- ループの中心はプロンプトではなく検証である。テスト、ビルド、型チェック、仕様差分などの外部証拠を優先する。
- ループは feedback が次の行動を変える場合に使う。固定作業をただ繰り返すだけならループではなく単発タスクとして扱う。
- 複雑さは必要になってから足す。まず単純なワークフローで始め、検証不能な自動化や無制限のサブエージェントは避ける。
- 作る agent と確認する agent は、価値がある場合だけ分ける。同じモデルの自己採点だけを完了条件にしない。
- 長く続く作業は、会話ではなく repo 内のファイルに記憶を残す。

参考:

- Addy Osmani, "Loop Engineering" (2026-06-07): https://addyosmani.com/blog/loop-engineering/
- Sandeco Macedo, "Stop Hand-Holding Your Coding Agent" (arXiv, 2026-06-28): https://arxiv.org/abs/2607.00038
- Anthropic, "Building effective agents" (2024-12-19): https://www.anthropic.com/engineering/building-effective-agents
- Simon Willison, "Designing agentic loops" (2025-09-30): https://simonwillison.net/2025/Sep/30/designing-agentic-loops/
- Business Insider, "Forget prompt engineering: 'Loop engineering' is all the rage now" (2026-06): https://www.businessinsider.com/what-are-loops-ai-engineering-tips-2026-6

## Youkan 基本ループ

### 1. Trigger

作業開始条件を明確にする。

- ユーザー依頼
- 仕様書と実装の不一致
- 失敗テスト
- レビュー指摘
- 量感カレンダーなど特定機能の違和感

開始時に読むもの:

- `docs/SPEC.md`
- 該当する `docs/SPEC/*.md`
- 関連する `docs/reference/vision/` または `docs/reference/decisions/`
- 既存テスト

### 2. Goal

完了条件を先に書く。

良い goal:

- 「F-06 の分母ルールが仕様書に明記され、`QuantityEngine` のテストで all/personal/company/tenant/team が通る」
- 「詳細カレンダーが量感のみを初期表示し、対象テストと build が通る」

悪い goal:

- 「いい感じに直す」
- 「使いやすくする」
- 「AI に任せる」

### 3. Plan

実装前に短く分解する。

標準順序:

1. 仕様確認
2. 仕様更新
3. 実装
4. テスト追加/更新
5. 検証
6. 変更履歴/引き継ぎ更新

大きい作業では `update_plan` を使う。小さい修正では過剰に計画しない。

### 4. Execute

Youkan では仕様書先行を原則にする。

- 挙動を決めたら、まず `docs/SPEC` に反映する。
- 実装は既存パターンに寄せる。
- 関係ない refactor はしない。
- Windows では `npm.cmd` を使う。
- `apply_patch` で編集する。

### 5. Verify

検証は可能な限り自動化された証拠で行う。

フロントエンド:

```powershell
cd JWCADTategu.Web
npm.cmd test -- --run <target test files>
npm.cmd run build
```

バックエンド:

```powershell
php <target test script>
```

検証レベル:

- Level 1: exit code、単体テスト、型チェック、ビルド
- Level 2: lint、schema、仕様差分確認
- Level 3: 手動操作、スクリーンショット、API 実データ確認
- Level 4: 別 agent / 別モデルによるレビュー
- Level 5: ユーザー判断

Level 4 や Level 5 を Level 1 の代わりにしない。

### 6. Stop

終了状態を明確にする。

- success: goal と verification が満たされた
- no-op: 調査の結果、変更不要だった
- blocked: 必要情報または外部状態が欠けて進められない
- exhausted: 予算・時間・安全上の制限で止めた

失敗したテスト、未実行の検証、残リスクは final に明記する。

### 7. Memory

次セッションのために、会話ではなくファイルへ残す。

- 仕様決定: `docs/SPEC/02_機能仕様.md` など該当 SPEC
- 変更理由: `docs/SPEC/06_変更履歴.md`
- 長い引き継ぎ: `docs/handover/YYYY-MM-DD-*.md`
- 共通ルール: `AGENTS.md` またはこの文書

## サブエージェント運用

サブエージェントは token を使うため、必要なときだけ使う。

使う場面:

- 実装者と検証者を分けたい
- 独立した調査が並列で進む
- 広いコードベースから狭い答えを探す
- 変更済み差分のレビューを別視点で行う

避ける場面:

- すぐ自分で確認できる単純な grep
- 次の一手がその結果に完全依存する blocking task
- 同じ範囲を複数 agent に重複調査させる

モデル選択:

- `gpt-5.4-mini`: grep、局所調査、既存パターン探索
- `gpt-5.4`: 中程度の実装、テスト修正、設計比較
- `gpt-5.5`: 広範囲の設計判断、難しいレビュー、複数領域にまたがる変更

原則:

- worker には書き込み範囲を明示する。
- explorer には具体的な質問だけ渡す。
- maker と checker を分ける場合、checker には差分と仕様を見せる。
- サブエージェントが完了したら閉じる。

## Youkan 量感カレンダー用ループ

量感カレンダーは仕様と体感がズレやすいので、専用ループを使う。

Trigger:

- 背景色が直感と合わない
- filterMode の切替で忙しさが変に見える
- 詳細画面とグリッド画面の量感が違う
- Google カレンダーや完了アイテムが反映されない

Goal:

- F-06 の分子/分母ルールと実装が一致する
- `QuantityEngine` の対象テストが通る
- `RyokanCalendar` と詳細カレンダーが同じ量感計算を使う

Verify:

```powershell
cd JWCADTategu.Web
npm.cmd test -- --run src/features/core/youkan/logic/QuantityEngine.test.ts src/features/core/youkan/logic/QuantityEngine.externalEvents.test.ts src/components/QuantityCalendar/__tests__/DetailQuantityCalendar.volumeFilter.test.tsx src/features/core/youkan/components/Calendar/__tests__/CapacityBar.test.tsx
npm.cmd run build
```

Memory:

- 分母・分子の仕様は `docs/SPEC/02_機能仕様.md` F-06 に書く。
- 仕様変更は `docs/SPEC/06_変更履歴.md` に書く。

## 次に進めるときのチェックリスト

作業開始時:

- [ ] `AGENTS.md` を読む
- [ ] この文書を読む
- [ ] 該当 SPEC を読む
- [ ] goal と verification を明文化する

実装前:

- [ ] 仕様書を更新したか
- [ ] 既存の実装パターンを確認したか
- [ ] テスト対象を決めたか

完了前:

- [ ] 対象テストを通したか
- [ ] build を通したか
- [ ] 変更履歴または handover を更新したか
- [ ] final に未解決リスクを書いたか
