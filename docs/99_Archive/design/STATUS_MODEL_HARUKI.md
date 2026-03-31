# Status Model (Haruki) - Single Source of Truth
ver 1.0

## 目的 (Philosophy)
*   **判断の回数を減らす**: 「これはどの状態か？」と迷う時間をゼロにする。
*   **罪悪感の排除**: 「保留(Pending)」を肯定的な選択として定義する。
*   **Internalの純化**: 納期（外圧）や警告をInternalな状態（Status）に混ぜない。

---

## 1. ステータス定義 (Status Dictionary)
**Statusは以下の5つに限定される。** これ以外のStatusをDBやUIに追加することを固く禁ずる。

| Key | 表示名 | 定義 (Definition) | 目的 (Goal) | 判定基準 (litmus test) |
|---|---|---|---|---|
| **`inbox`** | **インボックス** | 「まだ判断していない」もの。<br>無条件の受け皿。 | **捕獲 (Capture)**<br>脳の外に出す。 | 「0秒で入れたか？」<br>「まだ何も決めていないか？」 |
| **`waiting`** | **待ち** | 「自分がボールを持っていない」もの。<br>他者や物理的な到着を待っている。 | **停止の正当化**<br>自分が動けない理由を明確にする。 | 「今、自分の手で進められるか？(No)」 |
| **`ready`** | **着手可** | 「今すぐ実行可能」なもの。<br>自分の手元にあり、やる気さえあればできる。 | **準備完了**<br>実行候補プールを作る。 | 「今、自分の手で進められるか？(Yes)」 |
| **`pending`** | **保留** | 「今はやらないと決めた」もの。<br>将来の検討リスト（棚）に入れる。 | **視界からの消去**<br>今週のノイズを減らす。 | 「今週、これを見る必要があるか？(No)」 |
| **`done`** | **完了** | 「終わった」もの。<br>結果の記録。 | **完了の喜び**<br>積み上げを可視化する。 | 「もう二度と触らなくていいか？」 |

---

## 2. 状態遷移定義 (State Transition Table)
矢印の方向のみ遷移可能。これ以外のルートはシステム的にブロック、または警告を出す。

| From | To | Trigger (Action) | 意味合い | 備考 |
|---|---|---|---|---|
| **Any** | `inbox` | Create | **発生** | 全てのタスクはここから始まる。 |
| `inbox` | `ready` | Plan / Schedule | **計画** | いつやるか、どうやるか決めた。 |
| `inbox` | `waiting` | Delegate | **依頼/手放し** | 誰かに投げた。 |
| `inbox` | `pending` | Defer / Shelf | **先送り** | 今は考えないことにした。 |
| `inbox` | `done` | Quick Do | **即実行** | 2分以内で終わらせた。 |
| | | | | |
| `ready` | `done` | Complete | **完了** | 仕事が終わった。 |
| `ready` | `waiting` | Blocked | **中断** | 作業中に何かが足りなくなった。 |
| `ready` | `pending` | Drop | **断念** | 「やっぱりやらない」と決めた。 |
| `ready` | `inbox` | Reset | **見直し** | 計画が破綻し、練り直す。 |
| | | | | |
| `waiting` | `ready` | Resume | **再開** | 連絡が来た/モノが届いた。 |
| `waiting` | `done` | Auto Complete | **自然消滅** | 待っている間に解決した。 |
| | | | | |
| `pending` | `inbox` | Review | **再浮上** | 週次レビュー等で掘り起こす。 |
| `pending` | `done` | Garbage | **廃棄** | やらずに終わる（ゴミ箱）。 |
| | | | | |
| `done` | `ready` | Undo | **取り消し** | 間違って完了した（直後のみ推奨）。 |

---

## 3. Flag & Derived (Statusではないもの)

以下の概念はStatusとして扱わず、属性(Flag)または計算結果(Derived)として表現する。

### Flags (属性)
*   **`flag:has_deadline`**: 納期がある（カレンダーに表示）。
*   **`flag:needs_decision`**: 情報不足で止まっている。
*   **`flag:is_projectized`**: 親プロジェクトがある。

### Derived Views (見え方)
*   **Today Candidates**: `status=ready` かつ (`date=today` OR `user_selected`).
    *   *System Note*: 「今日やる(Today Commit)」というStatusは存在しない。「Ready状態のものを、今日の枠（View）に入れた」だけである。
*   **Overdue**: `status != done` かつ `deadline < today`.
    *   *System Note*: 「遅延」というStatusは存在しない。「遅れているReady」または「遅れているWaiting」があるだけ。

---

## 4. マッピング (Migration Guide)

旧システムからの移行ルール。

| 旧 Status | 新 Status | 必要な処理 |
|---|---|---|
| `active` | `ready` | - |
| `preparation` | `waiting` or `ready` | `prep_date` > Today なら `ready` (Future Filter). |
| `scheduled` | `ready` | `prep_date` がある `ready` として扱う。 |
| `decision_required` | `inbox` | Flag `needs_decision = true` を付与。 |
| `decision_hold` | `pending` | - |
| `decision_rejected` | `done` | Tag `garbage` を付与？ または物理削除。 |
| `intent` | `pending` | Tag `intent` を付与。 |
| `today_commit` | `ready` | Flag `is_today_commit = true` (一時的) or Session Table管理。 |
