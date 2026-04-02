# 引き継ぎ書: backPC 第2回セッション (2026-04-02)

**作成日**: 2026-04-02
**作成者**: Claude Code（指揮AI）

---

## 今日やったこと

### SdDD環境セットアップ
- `CLAUDE.md` 新規作成（方式A: sddd/rules.md 参照方式）
- `docs/sddd/rules.md` にSdDDルール本体を配置
- `docs/` 大規模整理: 旧ファイル20+を `99_Archive/`、参照資料を `reference/` に移動
- `docs/spec/` にSdDD仕様書6ファイルのみに整理

### 機能実装（R-004〜R-008）
- R-004: ブラウザタブタイトル「JBWOS」→「Youkan」
- R-005: 全体一覧を「全て」フィルタで開く
- R-006: `completed_at` カラム追加 + カレンダー振り返り表示
- R-007: ガントチャート「今月を表示」中央スクロール
- R-008: View名変更（全体一覧→状況把握、全体一覧2→全体一覧）

### バグ修正（R-009〜R-013）
- R-009: 会社プロジェクト表示の無限再帰（循環参照防止）
- R-010: 総会プロジェクト表示バグ（showGroups時のプロジェクト名付加抑止）
- R-011: ガント一覧モード切替が動作しない（VolumeCalendarScreenのshowGroups接続）
- R-012: ガント一覧モード改善（フラットリスト化・ソート・プロジェクト名表示）
- R-013: [総会]バグ根本修正（本番DB不正データ削除 + CalendarControllerパラメータ修正 + 防御コード）

### UI調整
- 全体一覧の列幅ボトルネック修正（columnWidth倍率削減 + QuickInput追従）
- 見出し/プロジェクト名にタイトル制限適用
- 見出し罫線を上に移動 + 隙間2px統一

### フローView（R-014）— feature/flow-view ブランチ
- **Phase 1完了**: item_dependenciesテーブル + DependencyController CRUD API + Dependency型定義
- **Phase 2完了**: @xyflow/react でFlowScreen実装、カスタムノード、未配置リスト、ドラッグ&ドロップ、エッジ接続

---

## 現在の状態

### ブランチ
- `master`: R-004〜R-013 + UI調整がデプロイ済み
- `feature/flow-view`: Phase 1 + Phase 2 完了。masterにはまだマージしていない

### 実運用テスト期間
- フローViewのPhase 3には入らず、数日間の実運用テストを行う
- フィードバック収集後にPhase 2.5（ルール微調整）を検討

### Phase 3 優先候補（フィードバック後に判断）
1. request_type 拡張
2. 確認テンプレートの選択肢UI
3. multi_intent 分割
4. 会話コンテキスト引き継ぎ
5. LLM化

---

## 本番環境の状態

| パス | 状態 |
|------|------|
| `contents/Youkan/` | 本番稼働中（R-013まで反映済み） |
| `contents/Youkan/backend/jbwos.sqlite` | ID=NULLの不正「総会」レコードを削除済み |
| `contents/Youkan/backend/jbwos.sqlite.bak_20260324_soukai_fix` | 2026-03-24時点のバックアップ |

---

## 参照すべきファイル

| 目的 | ファイル |
|------|---------|
| Youkan仕様書目次 | `docs/SPEC.md` |
| フローView仕様 | `docs/spec/03_画面設計.md §7` |
| 依存関係テーブル仕様 | `docs/spec/04_データ設計.md §3.5` |
| requests | `docs/requests.md` |
| 対応履歴 | `docs/request_log.md` |
| SdDDルール | `docs/sddd/rules.md` |
