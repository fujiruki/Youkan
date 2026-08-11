# R-077 フローチャート Enter キー新規ノード追加時の 409 エラー 分析記録

## 症状

フローチャート画面でノードを選択して Enter キーを押すと、新規ノードは作成されるが
トースト「ノード追加失敗 Error: API Error: 409」が表示される。発注者からの追加情報により、
409 が出た後もアイテム・依存関係自体はバックエンド側で作成されており、接続線（edge）だけが
画面に表示されない、という症状であることが判明した。

## 実機調査で確認した事実

dev 環境（localhost:5173 / localhost:8000、chrome-devtools MCP は他 Agent のプロファイルロックで
起動不可のため claude-in-chrome MCP を使用）で、以下を実際にネットワークタブ・DOM・React state を
直接観測しながら検証した。

1. **単発の Enter（チェーンなし）**: ノードを選択して Enter を 1 回押す操作は、`POST /items` →
   `POST /items/{id}`（meta 更新）→ `POST /dependencies` の 3 リクエストが必ず 1 回ずつ発火し、
   すべて 200、edge も正しく描画される。単純な操作では 409 は再現しない
   （デプロイ検証 Agent の本番確認結果とも一致）。
2. **同一選択ノードへの高速連続 Enter（同一 tick で 2 回 dispatch）**: `createNodeBelow` が 2 回
   独立に走り、`createNewItem` がその都度新しい UUID を発行するため、2 つの異なる子ノード・
   2 つの異なる依存関係ペアが作られる。target が毎回異なるため 409（重複ペア）にはならない。
3. **R-074 で新設された「連続追加UXフロー」（タイトル入力 → Tab → 目安時間入力 → Enter）の
   Tab キー部分**: 実ブラウザの Tab キー（`computer.key`）でも、ページ内 JS からの
   `dispatchEvent(new KeyboardEvent('keydown', {key:'Tab', ...}))`（CDP を経由しない、素の
   DOM イベント）でも、**共通して同じ現象**を確認した。
   - `FlowItemNode.tsx` の Tab ハンドラ（`e.preventDefault()` → `handleSubmit()` →
     `setChainOnConfirm(true)` → `setIsTimeEditing(true)`）自体は正しく実行される
     （`defaultPrevented: true`、目安時間 `<input placeholder="1h">` が実際に DOM に描画されることを確認済み）。
   - しかし `document.activeElement` はこの `<input>` にはならず、`reactFlowWrapper`
     （`tabIndex={0}` を持つ `<div>`）になる。300ms 待っても target 側の
     `useEffect(() => { timeInputRef.current.focus(); }, [isTimeEditing])` はフォーカスを
     奪還できていなかった。
   - これは CDP 特有のアーティファクトではなく、**タイトル `<input>`（フォーカスされていた要素）が
     Tab ハンドラの `handleSubmit()` → `onEditComplete` → 親の `setEditingNodeId(null)` を
     経由して同一コミットで DOM から除去されるため、ブラウザが最も近い focusable な祖先
     （`reactFlowWrapper`）へフォーカスを退避させる**、という DOM の一般的挙動に起因する
     可能性が高い（実ユーザーでも起こりうる、自動化ツール固有ではない不具合）。
   - この状態でユーザーが「目安時間欄に入力しているつもり」で文字や Enter を打つと、実際には
     `reactFlowWrapper` の **グローバル `handleKeyDown`**（`FlowScreen.tsx`）にイベントが渡る。
     `shouldIgnoreKeyEvent` は `event.target.tagName === 'INPUT'` でない限り `false` を返すため、
     グローバルの `case 'Enter': createNodeBelow(selectedNode, 0)` 等、意図と異なるショートカットが
     誤発火しうる導線が存在することを実機で確認した。
4. **選択状態が失われる副次的な不具合も発見**: `FlowScreen.tsx` の派生 `useEffect`（202〜260行目付近）
   が `nodes` を丸ごと再構築する際、`itemNodes` の各要素に `selected` プロパティを一切設定していない。
   そのためノード作成・編集のたびに ReactFlow 内部の選択状態が失われ、`selectedNodeIds` が空になる
   （`.react-flow__node.selected` が実機で 0 件になることを確認）。この影響で上記 3. の「誤発火」は
   `selectedNode` が undefined になっているタイミングでは発火しないなど、再現条件が非決定的になっている。
5. **時間入力 `<input>` に直接 Enter を dispatch した場合（フォーカス問題を迂回した場合）**:
   `POST /items` → `POST /items/{id}` → `POST /dependencies` が過不足なく 1 回ずつ発火し、正常に完了する。
   → **チェーン作成のロジック自体（`onChainCreate` → `createNodeBelow`）は単体では正しい**。
   バグは「意図した経路が呼ばれること」の保証（フォーカス管理）側にある。

## 根本原因

上記 3.〜4. の組み合わせ（Tab 後のフォーカス迂回＋選択状態の揮発性）により、ユーザーが連続追加
UX フローを使う際に、同一の依存関係作成が意図せず重複して試みられうる余地がコード上に存在する
（自動化ツールでは選択状態の非決定性のため 100% 再現するシーケンスを組み立てられなかったが、
発生メカニズム自体は実機で確認済み）。

しかし、**トリガーが何であれ**、このバグの実害（発注者が見ている症状）を生んでいる直接の原因は
別の場所にある。バックエンド（`DependencyController::create()`）は `UNIQUE(source_item_id,
target_item_id)` 制約違反を 409 "Dependency already exists" として返す仕様だが、フロントエンドの
`createNodeBelow`（`FlowScreen.tsx`）はこれを他の失敗と区別せず同じ catch ブロックで処理していた:

```ts
try {
  const newItemId = await createNewItem(parentX + offsetX, parentY + 120);
  if (newItemId) {
    const dep = await dependencyRepo.createDependency(parentNodeId, newItemId);
    appendDependencyToState(dep);   // 409 のときはここに到達しない
  }
} catch (err) {
  showToast({ type: 'error', title: 'ノード追加失敗', ... }); // 409 でも失敗扱い
}
```

409（＝「求めている依存関係は既に存在する」）は本来エラーではなく「望む終状態が達成済み」で
あるにもかかわらず、例外として扱われるため (a) 誤解を招く「ノード追加失敗」トーストが出て、
(b) 例外が `appendDependencyToState` 呼び出し前に投げられるため、実際にはサーバー側に存在する
依存関係がローカル `edges` state に反映されず、接続線が表示されない。これが発注者の報告
「アイテムも依存関係も作られているのに 409 が出て、接続線が表示されない」と完全に一致する。

なお、トーストの文言が「Dependency already exists」ではなく汎用的な「API Error: 409」だった点も
別の実装ミスに起因することを特定した。バックエンドの `BaseController::sendError()` は
`{'error': $message}` という key でエラーメッセージを返すが、`ApiClient.performRequest()` は
`errorData.message`（存在しない key）しか見ていなかったため、常に `API Error: {status}` という
汎用文言にフォールバックしていた。これが調査を難しくした一因でもある。

## 対応方針・実装（TDD）

ponytail の「共通の呼び出し元をまとめて直す」原則に従い、`createNodeBelow` だけでなく
`handleEdgeInsert`・`onNodeDragStop` の重なり自動接続・Ctrl+L 手動リンク作成など、
依存関係作成を行うすべての呼び出し元が経由する **`DependencyRepository`（共通層）** に
冪等化ロジックを1箇所だけ実装した。個別の呼び出し元（`FlowScreen.tsx`）は一切変更していない。

1. `JWCADTategu.Web/src/api/client.ts`
   - エラーメッセージ抽出を `errorData.error || errorData.message || ...` に修正
     （バックエンドの実際のレスポンス形式に合わせる）。
   - 投げる `Error` に HTTP ステータスコードを `status` プロパティとして付与し、
     呼び出し元がステータスコードで分岐できるようにした。
2. `JWCADTategu.Web/src/features/core/youkan/repositories/DependencyRepository.ts`
   - `createDependency()` で 409 を捕捉した場合、例外を投げる代わりに `getDependencies()` で
     既存の依存関係を取得し、該当する `source/target` のペアを返すよう変更（冪等化）。
     409 以外のエラーは従来通りそのまま re-throw する。

### テスト（Red → Green 確認済み）

- `JWCADTategu.Web/src/api/__tests__/client.errorStatus.test.ts`（新規）
  - バックエンドの `{ error: message }` が `Error.message` に反映されること
  - 投げられる `Error` に `status` プロパティが付与されること
- `JWCADTategu.Web/src/features/core/youkan/repositories/__tests__/DependencyRepository.test.ts`（新規）
  - 409 の場合は例外を投げず既存の依存関係を返すこと（本修正の中心）
  - 409 以外のエラーはそのまま投げること（回帰防止）
  - 正常系は従来通り動作すること（回帰防止）

いずれも実装前に Red（新規 5 テスト中、修正対象の 1 件が失敗、他は現行仕様通りの結果）を確認した上で
実装し、Green を確認した。

### 全体テスト結果

`npm.cmd run test -- --run`（フロントエンド Vitest 全件、790 tests）: 1 件失敗
（`useAssigneeView.test.ts` の「today」バケット分類）。この失敗は本修正前の `master` 相当のツリーでも
同様に失敗することを `git stash` で確認済みであり、本修正とは無関係な既存の失敗（日付依存の
可能性が高い）。それ以外の 775 件（+ skip 14 件）はすべて成功、新規追加分を含め回帰なし。

### 実機確認

- `POST /items` → `POST /items/{id}` → `POST /dependencies` の単発 Enter フローは修正後も
  引き続き 3 リクエストとも 200、edge も正しく描画されることを確認（回帰なし）。
- 409 を伴う重複依存関係作成のシナリオそのものをブラウザ経由で決定論的に再現することは
  自動化ツールの制約上できなかったが（上記「選択状態の揮発性」により非決定的なため）、
  `DependencyRepository` の単体テストで 409 レスポンスに対する新しい挙動（例外を投げず既存の
  依存関係を返す）を直接検証済み。

## 今回スコープ外として残した関連不具合（別要望候補）

今回の 409 修正はどのトリガーであっても効く保険的な修正だが、実機調査で以下 2 点の
**別の実在する不具合**も確認した。409 の直接原因ではなく、「連続追加UXフローで依存関係の
重複作成が起こりうる」土壌になっている可能性がある。次の要望として `docs/requests.md` へ
起票することを推奨する。

1. **Tab 確定後、目安時間欄にフォーカスが移らない**（`FlowItemNode.tsx`）: タイトル `<input>`
   が Tab ハンドラ経由で DOM から除去される際、ブラウザが `reactFlowWrapper` へフォーカスを
   退避させ、`useEffect` によるフォーカス奪還が間に合わない（実機で確認済み）。
2. **ノード作成・編集のたびに ReactFlow の選択状態が失われる**（`FlowScreen.tsx` 202〜260行目付近）:
   派生 `useEffect` が `itemNodes` を再構築する際に `selected` プロパティを保持していない。
