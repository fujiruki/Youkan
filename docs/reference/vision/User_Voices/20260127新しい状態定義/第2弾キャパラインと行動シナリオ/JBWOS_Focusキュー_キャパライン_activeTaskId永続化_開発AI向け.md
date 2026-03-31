# Focusキュー＋キャパライン＋Now（activeTaskId）サーバー永続化：設計ブリーフ（開発AI向け）

目的：**「判断疲れを減らしつつ、現実の納期・キャパに合わせて前に進む」**を、状態モデルを増やさずに実現する。  
結論：**Focusを“今日触る可能性がある集合（状態）”として維持**し、Dashboard側の表示・操作で **順序付きキュー＋キャパライン** を提供する。  
加えて「今やってる（Now）」を **activeTaskId をサーバー永続化**して端末間（PC/スマホ）で同期する。

---

## 1. 背景（ユーザー特性と設計意図）
- ユーザー（晴樹）は、タスクが増えるほど「完璧に並べたい欲」が強まり、判断が終わらず疲労・停滞しやすい。
- しかし、現実には納期と割り込みがあるため「時間軸ゼロ」だけでは破綻する。
- 解決方針：  
  - **“決めきれない”を前提にして前進できるUI**（ぽんぽん候補に入れる→キャパ超過が見える→優先順だけ調整→上から着手）
  - **「禁止」「追い詰め」ではなく可視化**（キャパ超過ライン）  
  - **状態（DB）を増やさない**：メンテ性を担保（MVVM / 状態遷移の爆発を避ける）

---

## 2. 用語定義（重要）
### 2.1 Focus（状態）
- **定義**：今日～近々で「触る可能性がある」タスク集合。  
- **NOT**：必ず今日やるリスト／着手中リストではない。
- **役割**：意思決定の対象を“狭める”ための集合。

### 2.2 Focusキュー（表示概念）
- **定義**：Focus状態のタスクを、**順序付き（並び替え可能）**に表示するDashboard上の表現。
- **ユーザー操作**：ドラッグ&ドロップで順序を変える。

### 2.3 Now（着手中）
- **定義**：現時点で「今やってる」1件（多くて1件）。  
- **実装**：activeTaskIdで表現（サーバー永続化して端末同期）。

### 2.4 キャパライン（Capacity Overline）
- **定義**：Focusキューを上から順に `estimateHours` を累積し、`dailyCapacityHours` を超えた位置に引く境界線。
- **意味**：**「今の並びだと今日のキャパを超える」**の視覚化。  
- **禁止ではない**：超えていてもOK（頑張る日もある）。ただし現実が見える。

---

## 3. 画面・情報構造（Dashboard責務）
### 3.1 Dashboard内セクション（推奨）
- Inbox（今日やるか決める）
- Waiting（他者/条件待ち）
- Pending（今は忘れて良い：塩漬け）
- Focus（候補キュー＋Now＋キャパライン）
- History（履歴）

※ Today専用画面は不要（切替コスト・二重管理・概念増で混乱しやすい）。  
「Today的機能」は **Focusセクション内** に統合。

### 3.2 Focusセクションの内部UI（推奨）
1) **Now枠（固定）**  
   - 表示：activeTaskIdのタスクカードを1件だけ表示  
   - 操作：  
     - 「着手」＝Focusキュー内の任意タスクを Now にする  
     - 「停止」＝activeTaskIdをnullにする（＝今やってない日も公式に）

2) **Focus Queue（順序付きリスト）**  
   - カードは1行表示（既存方針B）  
   - ドラッグで並び替え（focusOrder更新）  
   - キャパラインを表示（累積計算）

3) **Overline以下の扱い**（失敗扱い禁止）  
   - そのまま残ってよい  
   - 翌日も順序維持＋キャパ再計算  
   - 任意で「Overline以下を明日へ（順序末尾へ）/ Pendingへ」などの軽操作（MVP外でも可）

---

## 4. 「並べ替え遊び」吸い込み防止（必要な安全装置）
ユーザーが疲れているほど“最適化遊び”に吸い込まれるため、**UIで静かに終わらせる**。

### 4.1 ルール（必須）
- 並べ替えは **Focusセクション内のみ**
- 並べ替え後、即保存（「保存」ボタンは作らない）
- フィードバックは最小：「保存しました」も出さなくて良い（ノイズになる）

### 4.2 追加の安全装置（推奨）
- 短時間に並べ替え回数が多い場合、控えめな文言を一度だけ表示  
  - 例：「並べ替えはここまででOK」  
  - 例：「次は上から1つだけ始めよう」  
- ここで煽り文言は禁止（達成/ご褒美/次へ等は不要）

---

## 5. データモデル（最小追加 + activeTaskIdのサーバー永続化）

### 5.1 既存前提
- task/door/item は同一テーブル（親子関係あり）  
- estimateDays/estimateHours、dueDate、myDueDate 等は既存 or 実装済み想定

### 5.2 追加（推奨・最小）
- `focusOrder: number`  
  - Focus状態の並び順（ドラッグの結果を永続化）
- `activeTaskId: string | null`（**サーバー永続化**）  
  - ユーザー単位で1件（Now）

### 5.3 スキーマ案（概念）
- Task（既存）：
  - id
  - parentId（任意）
  - status（Inbox/Waiting/Pending/Focus/Done 等）
  - estimateHours（任意）
  - ...（dueDate/myDueDate 等）
  - **focusOrder**（NEW, nullable）
- UserState（新規 or 既存設定テーブルに追加）：
  - userId
  - **activeTaskId**（NEW）
  - dailyCapacityHours（既存 or NEW：デフォルト8など）

---

## 6. ロジック仕様（MVVMを意識した責務分離）

### 6.1 ViewModel（計算責務）
- `focusQueue = tasks.filter(status==Focus).sortBy(focusOrder, createdAtFallback)`
- `nowTask = tasks.find(id==activeTaskId) || null`
- `capacityLineIndex`：
  - 先頭から `estimateHours` 累積
  - `cum > dailyCapacityHours` となる最初のindexを境界に
  - estimateHours未設定は暫定で 0h or 0.5h等（要ポリシー。MVPでは0でも可）

### 6.2 操作（Intent）
- SetNow(taskId):
  - activeTaskId = taskId をサーバー保存
  - 可能なら task.status を Focus に寄せる（NowはFocusの一部として扱うのが自然）
- ClearNow():
  - activeTaskId = null をサーバー保存
- ReorderFocus(fromIndex,toIndex):
  - focusOrder を再採番して保存
  - 保存は即時（最適化遊びを長引かせない）
- AddToFocus(taskId):
  - status=Focus、focusOrder末尾へ

---

## 7. 「Ready」→「Focus」命名と心理的役割（要点）
- Readyは「やるべき感・圧」が強く、1件で“十分”メッセージと衝突しやすい
- Focusは「触る可能性」＝心理的安全が高い
- “やる／やらない”の罪悪感は、**キャパライン**で現実を見せることで代替する

---

## 8. 実装判断（今回の決定事項）
1. **Focusは件数制限しない**
2. **代わりに、Focusキューにキャパラインを表示する**
3. **「今やってる」は activeTaskId をサーバー保存して端末間同期する**
4. Today画面は作らず、DashboardのFocusセクション内で吸収する（概念増を避ける）
5. 状態モデルは増やさない（Viewの工夫で実現）

---

## 9. 開発AIへの確認ポイント（実装前の論点）
- activeTaskIdの保存先：
  - UserState（推奨） or Settings
  - マルチユーザー対応時は userId が必須
- focusOrderの採番戦略：
  - 連番（1..n）で再採番
  - あるいは浮動小数で差し込み（ただし実装は複雑化）
- estimateHours未設定時の扱い（MVPは0で可。将来の導線で入力促進）

---

## 10. 期待される効果
- 「候補を入れる」コストが低い（Inbox→Focus移動が軽い）
- 「今日やりすぎ」問題が脳内計算ではなく視覚で分かる（キャパライン）
- 端末跨ぎで “今やってる” がブレない（activeTaskId同期）
- 「並べ替え遊び」の吸い込みを最小化（即保存・静かな制御）
