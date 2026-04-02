# Youkan

## Agent-フローView Phase2: フローチャートView
### タスク
- [x] タスク0: @xyflow/react インストール
- [x] タスク1: FlowScreen基盤
  - [x] 1-1. ViewState に 'flows' 追加（App.tsx）
  - [x] 1-2. YoukanHeader にフロータブ追加
  - [x] 1-3. FlowScreen コンポーネント作成（空の@xyflow/reactキャンバス）
  - [x] 1-4. URLルーティング追加
- [x] タスク2: ノード表示
  - [x] 2-1. カスタムノードコンポーネント（アイテムタイトル表示）
  - [x] 2-2. 依存関係APIからエッジデータ取得
  - [x] 2-3. アイテムデータからノード生成（meta.flow_x/flow_y使用）
  - [x] 2-4. ノード・エッジをReactFlowに描画
- [x] タスク3: 未配置アイテムリスト
  - [x] 3-1. 右上固定の未配置リストUI
  - [x] 3-2. リストからキャンバスへのドラッグ&ドロップ
- [x] タスク4: 基本操作
  - [x] 4-1. ノードのドラッグで位置移動（flow_x/flow_y自動保存）
  - [x] 4-2. ノード間のエッジ接続（Handle + addEdge → POST /dependencies）
  - [x] 4-3. エッジ/ノード削除（DELETE /dependencies）
- [x] ビルド確認（tsc --noEmit + vite build）
