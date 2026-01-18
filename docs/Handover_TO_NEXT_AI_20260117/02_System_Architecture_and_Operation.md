# 02_System_Architecture_and_Operation: システム構造と操作

## アーキテクチャ概要
本システムは「積層型アーキテクチャ」を採用しています。詳細は `docs/System_Layer_Architecture.md` を参照してください。

1.  **JBWOS Core (Platform)**: 汎用的なタスク管理・意思決定エンジン。
2.  **Manufacturing Layer (Extension)**: モノづくり共通の中間層。「Manufacturing Bus」により複数プラグインを束ねます。
3.  **Domain Plugins**: `Tategu Plugin` (建具), `Furniture Plugin` (家具), `Mock Plugin` (テスト用) など。

### 技術スタック
- **Frontend**: React (Vite), TypeScript, Tailwind CSS
- **Backend**: PHP (Built-in Server for Dev), SQLite (Planned)
- **Repo Structure**: `JWCADTategu.Web` (Frontend source), `backend` (API source)

## JBWOS の独自概念

### 1. Future Board (Tomorrow Planning)
**「明日を設計する」ための画面**です。
- **目的**: Inboxにあるタスクや、保留中(Standby)のタスクを、明日のカレンダー（時間割）に割り振る。
- **操作**:
    - **Inbox/Stock**: 画面左側。未処理のタスクが並ぶ。
    - **Day Columns**: 画面右側。明日、明後日...の日付ごとの列。
    - **Drag & Drop**: 左から右へアイテムをドラッグして、実行日を確定する。
- **Mock Factory**:
    - サイドバー下部にある「外部ソース」エリア。
    - プラグイン（Mock Manufacturing Pluginなど）から提供される「外部アイテム（例: Test Box A）」が表示される。
    - これをカレンダーにDnDすることで、外部システム（建具見積もりなど）のデータをJBWOSのタスクとして取り込む（Import）ことができる。

### 2. Today Screen
**「今日、いま」に集中するための画面**です。
- **目的**: 今日やると決めたタスクを上から順に消化する。
- **機能**: 完了、先送り、完了logへの記録。

### 3. Global Decision Board (GDB)
**すべてのタスクの司令塔**。
- **Active / Standby / Decision Hold** 等のステータスでタスクを分類・管理する。

## データフロー (Manufacturing Bus)
1.  **Registration**: アプリ起動時、`ManufacturingBus.ts` が各プラグイン（`MockManufacturingPlugin`など）を登録。
2.  **Fetching**: `FutureBoard` は `ManufacturingBus.getSources()` を呼び出し、全プラグインから利用可能なアイテムを取得してサイドバーに表示。
3.  **Import**: ユーザーが外部アイテムをカレンダーにドロップすると、`vm.importFromPlugin()` が発火。アイテム情報がJBWOSの `Item` としてデータベース（現在はIndexedDB/Memory）に保存される。
