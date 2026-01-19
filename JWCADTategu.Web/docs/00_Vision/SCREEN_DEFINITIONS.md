# 画面定義と用語集 (Screen Definitions & Terminology)

## 1. 画面構成 (Screens)

### JBWOS Dashboard (メイン画面)
アプリケーションの起動直後に表示されるダッシュボード。
別名: "Today's Decision", "Global Decision Board"
- **役割**: 日々のタスク消化、意思決定（Decision）、情報の一元管理を行う。
- **主要コンポーネント**:
  - **Global Decision Board (GDB)**: タスクの入力を受け付け、状態（Active/Standby/Intent/Log）を管理するボード。
  - **Quantity Calendar (量感カレンダー)**: 期間ごとのタスク量や予定を可視化するカレンダーモード。
  - **Side Memo**: 右側に常駐する一時メモ欄。

### Joinery Schedule (建具スケジュール)
サイドメニューからアクセスする、建具プロジェクト管理画面。
別名: "Tategu Schedule", "Project List"
- **役割**: 各現場（プロジェクト）とそれに紐づく建具表（Deliverables）を管理する。
- **主要機能**:
  - プロジェクトの新規作成・編集・アーカイブ・削除。
  - 建具（Door）の詳細入力、寸法や仕様の管理。
  - **Deliverable Integration**: 建具データをJBWOSのタスクとして連携する。

### Settings (設定画面)
アプリケーションの全般的な設定を行う画面。
- **役割**: 休日設定、稼働能力（Capacity）設定、その他の環境設定。
- **ナビゲーション**: 左上の戻るボタンでDashboardへ戻る。

## 2. Global Decision Board (GDB) 用語定義

GDBは以下の「Shelf（棚）」と呼ばれる領域で構成される。

### Active / Inbox (今日やるか決める)
- **意味**: まだ判断が下されていないタスク、または今日判断すべきアイテム。
- **アクション**: ユーザーはここにあるアイテムに対して「Yes（Today Commit）」「Hold（Standby）」「No（Log/Intent）」の判断を下す。
- **ThrowIn**: クイック入力で追加されたタスクはここに入る。

### Standby / Preparation (準備・出番待ち)
- **意味**: 「いつかやる」が決まっているが、今日ではないもの。「出番待ち」状態。
- **Blurry Date**: 明確な期日ではなく「量感（Quantity）」として日付や週に割り当てられる。

### Someday / Intent (いつかやれたら)
- **意味**: 具体的な期日はないが、意志（Intent）として持っておきたいもの。
- **挙動**: 期限切れにならず、ここに残り続ける。ドラッグ＆ドロップで「Active」や「Standby」からここに移動可能。

### Log / History (履歴)
- **意味**: 完了したタスク、または「今回はやらない」と判断されたタスクの記録。

## 3. その他の重要用語

- **Today Commit**: 今日実行すると約束したタスク（最大2件推奨）。
- **Execution Item**: 現在進行中の、たった一つのタスク。Focusモード時に大きく表示される。
- **Panorama Mode**: GDBを横並びのカラム（Masonry Layout）で一覧表示するモード。縦スクロールですべての棚を見渡せる。
- **Focus Mode**: 標準の表示モード。Activeなタスクに集中するための縦型レイアウト。
