# 2026-07-06 Loop Engineering Handover

## 目的

Youkan の今後の作業を、単発プロンプトではなく loop engineering の進め方で継続できるようにした。

## 追加した入口

- `AGENTS.md`
- `docs/AGENT_LOOP_ENGINEERING.md`
- `docs/SPEC.md` の開発ルール一覧に `AGENT_LOOP_ENGINEERING.md` を追加

## 採用したループ定義

Youkan では次の 6 要素で作業する。

1. Trigger: ユーザー依頼、失敗テスト、仕様差分、レビュー指摘
2. Goal: テスト・ビルド・仕様差分で確認できる完了条件
3. Execute: 仕様書先行、既存パターン準拠、最小変更
4. Verify: 対象テスト、build、必要に応じて API/手動確認
5. Stop: success / no-op / blocked / exhausted
6. Memory: SPEC、変更履歴、handover に保存

## 現在の次タスク候補

量感カレンダーの続きとして、会社全体キャパの精度を上げる。

現状:

- 会社/チームスコープの分母は `isCore` member の日別キャパ合計。
- `memberships.capacity_profile` があれば、日別会社例外 → 曜日別会社配分 → 日別総量例外 → 曜日別標準 → `dailyCapacityMinutes` の順で使う。
- `/members` と `/tenant/members` は `capacityProfile` を返す。
- `/tenant/members/{id}` は `capacity_profile` を保存する。

次の設計課題:

- 既存 DB に `capacity_profile` を追加する migration を本番適用する。
- メンバー画面の文字化け表示を直し、キャパ設定 UI の説明を明確にする。
- 会社アカウントと個人アカウントの会社モードで、どの tenant context を使うかを画面全体で統一する。

推奨ループ:

1. `docs/SPEC/03_画面設計.md` でメンバーキャパ設定 UI を整理する。
2. `MembersScreen.tsx` の文字化けとラベルを修正する。
3. PHP の migration 実行手順を確認し、本番適用前チェックを作る。
4. 必要なら `/members` の API テストを追加する。

## 検証コマンド

```powershell
cd JWCADTategu.Web
npm.cmd test -- --run src/features/core/youkan/logic/QuantityEngine.test.ts src/features/core/youkan/logic/QuantityEngine.externalEvents.test.ts src/components/QuantityCalendar/__tests__/DetailQuantityCalendar.volumeFilter.test.tsx src/features/core/youkan/components/Calendar/__tests__/CapacityBar.test.tsx
npm.cmd run build
```
