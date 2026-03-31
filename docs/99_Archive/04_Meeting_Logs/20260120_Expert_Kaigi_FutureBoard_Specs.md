# Expert Meeting Log: Future Board Enhancement Specs
Date: 2026-01-20
Topic: Future Board (Weekly Planning) Improvements
Participants: PM (User Proxy), Architect, UI/UX Designer

## 1. 目的（Objective）
Future Board（明日の計画/週間計画）において、より現実的で柔軟な計画可能にするため、以下の機能仕様を確定する。
1. **休業日・祝日の表現・制御**: 定休日や祝日にタスクを誤って配置しない、または自動的にスキップする。
2. **複数日にまたがるタスク**: 「火曜午後～木曜午前」のような長期タスクの可視化。

## 2. 決定事項（Decisions）

### A. 休業日ロジック (Holiday Logic)

#### 現在の仕様 (Current)
- `capacity.ts` / `isHoliday` 関数が存在。
- `config.holidays` (Weekly) と `config.exceptions` (Specific) で判定。
- **課題**: UI上で視覚的にユーザーが設定変更する手段がない（コード定義のみ？）。例外日はDB保存が必要。

#### 新・仕様 (New Spec)
- **設定UI**: `SettingsScreen` または `FutureBoard` 内に「稼働設定」ボタンを追加。
- **データ構造**: JBWOSの設定 (`db.settings`) に `capacityConfig` を正式に持たせる。
- **ロジック**:
    - **定休日**: 曜日指定（例: 火・水）。トグルでOn/Off。
    - **祝日**: 日本の祝日ロジック（`date-holidays-jp` 等のライブラリ使用推奨だが、今回は軽量化のため「指定日リスト」または「ユーザー手動クリックで赤くする」を採用）。
        - *Decision*: ユーザーがカレンダー日付をクリック→「休日/稼働日」をトグルできる簡易UIを優先。
- **ドラッグ＆ドロップ挙動**:
    - 休日カラムへのドロップ: **許可する**（「休日出勤」の意思表示かもしれないため）。ただし、警告表示や「休日マーク」を付ける。
    - ゴースト計算: 休日は**工数計算から除外**する（既に実装済みのロジックを強化）。

### B. 複数日にまたがるタスク (Multi-Day Tasks)

#### 現在の仕様 (Current)
- `work_days` プロパティで日数を保持。
- `FutureBoard` は `head` (開始日) と `ghost` (続き) をレンダリング。
- **課題**: 「火曜 午後開始、水曜休み、木曜完了」のような「時間単位のまたがり」や「中抜け（休日挟み）」が視覚的にわかりにくい。

#### 新・仕様 (New Spec)
- **分割表示**:
    - 今日の分（Head）と翌日以降（Ghost）を明確につなぐビジュアル（矢印やコネクタ線）は技術的に重いため、**「続き（Remaining: X日）」バッジ** で表現を統一。
- **休日スキップの可視化**:
    - タスクが火曜（1日）→水曜（休）→木曜（1日）の場合：
        - 火曜: Task A (Head)
        - 水曜: (Ghost表示なし - Holiday)
        - 木曜: Task A (Ghost - Final)
- **時間単位の分割**:
    - 厳密なガントチャートではないため、「午前/午後」スロットまでは作らない。
    - 「1.5日」の場合：
        - Day 1: Head (1日分)
        - Day 2: Ghost (0.5日分 - 短く表示？あるいは「AMのみ」アイコン)
        - *Decision*: Ghostカードに「残り時間」を表示する現状維持でOK。

## 3. 実装計画 (Implementation Plan)

### Phase 1: データ・ロジック整備
1. `CapacityConfig` をDB (`db.settings`) から読み込むように `useJBWOSViewModel` を改修。
2. `isHoliday` ロジックがそのDB設定を参照するように修正。

### Phase 2: UI実装 - 休日設定
1. Future Board ヘッダー日付をクリックしたときに、クイックメニュー表示。
    - 「この日を休日に設定/解除」
    - 「稼働時間を変更（例: 半日）」
2. カレンダーカラムの見た目強化（赤背景、斜線など）。

### Phase 3: UI実装 - タスクまたがり
1. `getItemStatusForDay` ロジックの再検証（休日スキップが正しく動くか）。
2. Ghostカードのスタイル調整（Headカードとの関連性がわかるように、ホバー時にHead/Ghost両方をハイライト）。

## 4. 開発者メモ (Developer Notes)
- `config.holidays` の定義場所を確認。現在はモックか定数か？
- `date-fns` はすでに導入済み。

---
**Next Action**: Implement Holiday Logic & Settings UI first.
