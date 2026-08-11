# R-074 フローチャート操作性・軽量化バンドル 分析記録

## (1) 依存線描画バグの根本原因

### 調査の要約

`FlowScreen.tsx` の `FlowCanvas` は、`nodes`/`edges` を `useNodesState`/`useEdgesState` で「controlled」に管理している。依存関係（edge）を追加する経路は4箇所ある。

| 経路 | 追加後に `setEdges` を直接呼ぶか |
|:--|:--|
| `onConnect`（ハンドルドラッグで手動接続） | 呼ぶ（`addEdge(...)`） |
| `createNodeBelow`（Enter/Tabキーで新規ノード作成時の依存追加） | **呼ばない**（`setDependencies` のみ） |
| `handleEdgeInsert`（ドラッグでエッジ上に挿入） | **呼ばない**（`setDependencies` のみ） |
| `onNodeDragStop` の重なり検出による自動接続 | **呼ばない**（`setDependencies` のみ） |

`onConnect` 以外の3経路は、`dependencies` state の更新を、`[placedItems, dependencies, editingNodeId, newNodeId, highlightNodeId, highlightEdgeId, ...]` を依存配列に持つ巨大な派生 `useEffect`（206〜257行目付近）が検知して `nodes`/`edges` を丸ごと再構築することにのみ依存していた。

この派生 `useEffect` は先頭に `if (isDragging.current) return;` というガードを持つ。`isDragging` は `useRef`（state ではない）なので、これが `true` のタイミングで `dependencies` が変化しても、effect は早期リターンして **何もせずに終わる**。ref の変化自体は再レンダリングのトリガーにならないため、次に `dependencies` 以外の何らかの state が変化してこの effect が再度呼ばれるまで、新しく作成された依存関係が `edges` に反映されないまま取り残される。

`onConnect` だけがこの問題を踏んでいなかったのは、`onConnect` だけが `setEdges` を直接呼んで edge をローカル state に即時反映しており、この派生 effect の実行タイミングに依存していなかったため。

実機（chrome-devtools MCP は他Agent使用中のため claude-in-chrome で代替）では、Enter キー単発の操作では毎回 edge が表示されることを複数回確認した（ローカル環境はネットワーク遅延がほぼ無いため、このタイミング依存のバグを単純な操作では再現しづらい）。一方で、`isDragging.current` が `true` の間に依存関係が作成されるケース（例: ノードドラッグ操作の直後に別ノードで依存関係を作る操作が重なる、複合的なドラッグ&キー操作等）は、コードレベルで再現性のある欠陥として `FlowScreen.enterEdge.test.tsx` の2件目のテストで実際に再現させ、Red確認済み。

### 対応方針・実装

「派生 effect のタイミングに依存しない」ようにするため、`onConnect` と同じパターンに統一した。

- `dependencyToEdge(dep, isHighlighted)` という単一の変換関数を新設し、Dependency → Edge の変換ロジックを1箇所に集約（派生 effect 内の map もこれを使う）
- `appendDependencyToState(dep)` ヘルパーを新設し、`setDependencies` と同時に `setEdges` へも直接反映するようにした
- `createNodeBelow` / `handleEdgeInsert` / `onNodeDragStop` の重なり接続 / `onConnect` の4箇所すべてで、依存関係作成後は edges へ即時反映するよう統一
- 派生 effect は「最終的な整合性を保証する再同期」としてそのまま残置（isDragging ガードも維持。ドラッグ中の重い再構築を避ける目的は変えない）

これにより、派生 effect が万一スキップされても edge は必ず即時に描画される。

## (2) アニメーション廃止・矢印表示

- `dependencyToEdge()` で `animated: false` を固定し、`markerEnd: { type: MarkerType.ArrowClosed }` を設定
- `onConnect` 内の edge 構築処理も同じスタイル定数（`DEPENDENCY_EDGE_STYLE`、`DEPENDENCY_EDGE_MARKER_END`）を使うよう統一

## (3) Enter連続追加UXフロー

- `FlowItemNode.tsx` の `isNewNode` による「タイトル自動フォーカス＋全選択」は既存実装のまま流用（重複実装なし）
- タイトル編集中の `handleKeyDown` に `Tab` ケースを追加: タイトルを確定（`handleSubmit()`）した上で、目安時間欄をローカル state (`isTimeEditing`/`chainOnConfirm`) で開く
- 目安時間欄の `onKeyDown` の `Enter` ケースで、`chainOnConfirm` が true の場合のみ `onChainCreate` を呼び、選択中ノードを親として次のノードを連鎖作成する（`chainOnConfirm` は Tab 経由でのみ true になるため、通常の目安時間クリック編集では誤発火しない設計。テストで担保）
- `onChainCreate` は `FlowScreen.tsx` 側で `createNodeBelow(itemId, 0)` を呼ぶ。ただし `createNodeBelow` は edge 構築 useEffect より後方で定義されるため、TDZ（Temporal Dead Zone）を避けるべく `createNodeBelowRef`（useRef）経由で受け渡している

## 実機検証の結果と制約

- chrome-devtools MCP は他Agent（R076担当）が使用中のプロファイルロックにより起動不可（`browser already running... Use --isolated` エラー）。claude-in-chrome MCP で代替検証を実施
- **確認できたこと**（実機、dev環境 localhost:5173/8000）:
  - Enterキーでの新規ノード作成のたびに、接続線（実線・矢印付き）が必ず表示されることを複数回連続で確認
  - 接続線の点滅アニメーションが無くなり、矢印で方向がわかる表示になっていることを確認（スクリーンショットで実線+下向き矢印を確認）
  - 新規ノード作成時にタイトル欄が自動的に編集状態になる（既存実装）ことを確認
- **確認できなかったこと**: Tabキーでのタイトル確定→目安時間欄フォーカス移動の実機確認。claude-in-chrome（CDPベースの自動化拡張）経由でTabキーを送信すると、ブラウザ側のネイティブなフォーカス走査が先に働き、`document.activeElement` が `<body>` になってしまい、`FlowItemNode.tsx` 側の `onKeyDown` ハンドラに Tab キーイベントが到達しないことを、一時的なデバッグログ（`window.__r074debug` への記録）で確認した。同じ入力欄で Enter キーは正常にハンドラへ到達し、`handleSubmit()` が呼ばれることを確認済みのため、Tabキーに特有の自動化ツール側の制約と判断した（`e.preventDefault()` を呼ぶタイミングより前に、CDP経由のTabキー入力がブラウザ本体のフォーカス走査を先に発火させている可能性が高い）。この挙動は既知のブラウザ自動化ツール一般の制約であり、実ユーザーのキーボード操作（ネイティブなtrustedイベント）ではReactのpreventDefault()が正しく機能することが期待できる
- Tab→目安時間→Enter連鎖の正しい動作は、`FlowItemNode.chainCreate.test.tsx`（4件、Vitest + Testing Library、実DOM操作の `fireEvent.keyDown` で検証）でRed→Green確認済み。次のAgentが実機で追加確認する場合は、chrome-devtools MCP（空いているタイミング）または実ユーザーによる手動確認を推奨する
