# Youkan 状態設計の議論まとめ

作成日: 2026-08-18

## 目的

晴樹の特性に合う形で、Youkanのタスク状態分類・優先順位付け・レビューの仕組みを整理する。

---

## 1. 現在検討している status

| status | 日本語名 | 説明 |
|---|---|---|
| `inbox` | 未整理 | 入ってきただけ。やる／やらない、時期、優先順位をまだ決めていない |
| `focus` | 今日やる | 今日の実行対象。1日の実行計画は4時間以内 |
| `todo` | 順番待ち | やることは決定済み。今日はやらないが、自分の順番が来たら着手する |
| `pending` | 条件待ち・時期待ち | やる意思はあるが、今は条件が整っていない、または指定時期まで動かさない |
| `confirmed` | 確定済み | 日程・内容・相手などが確定。ただしstatusではなく属性にする案 |
| `decision_hold` | 判断保留 | やるかどうか自体をまだ決めない |
| `decision_rejected` | 見送り | 検討した結果、やらないと判断 |
| `waiting` | 相手待ち | 返信・納品・判断など、他人のアクション待ち |
| `done` | 完了 | 実行して終了 |
| `cancel` | 中止・見送り | 不要になった、途中でやめた、実行しないと決めた |

---

## 2. 現時点での推奨構造

基本の本道。

```text
inbox → todo → focus → done
```

例外処理。

```text
waiting
pending
cancel
```

最終候補は7状態。

- `inbox`
- `todo`
- `focus`
- `waiting`
- `pending`
- `done`
- `cancel`

### confirmed

`confirmed` はstatusから削除する方向。

「確定している」は作業状態ではなく属性なので、例えば以下で持つ。

- `due_date`
- `scheduled_at`
- 必要なら `is_confirmed`

### decision_hold / decision_rejected

- `decision_hold` → `pending` に吸収
- `decision_rejected` → `cancel` に吸収

判断状態と作業状態を同じstatus軸に混ぜない。

---

## 3. 「納期は決めたが今日はやらない」タスク

以下なら `todo`。

- やることは決めた
- 納期・目安期日は入力済み
- 今日はやらない
- 他人待ちではない
- 条件待ちでもない
- 先にやるべきことが終わり、順番が来たらやる

つまり、

**`todo` = やると決めた順番待ち**

---

## 4. pending の具体例

`pending` は「やる意思はあるが、今は動く条件が整っていない」。

例:

- 補助金の公募が始まったら申請準備
- 展示会の募集要項が公開されたら申請判断
- 9月になったら個展DMを詰める
- 材料価格が出たら見積を再検討

### waitingとの違い

- 人の返信・納品・判断を待つ → `waiting`
- 時期・イベント・条件成立を待つ → `pending`
- 単に自分の順番待ち → `todo`

---

## 5. pending_condition と review_date

`pending` には「何待ちか」を必ず残せるようにする。

```yaml
pending_condition: 展示会の募集要項が公開されたら
review_date: 2026-10-01
```

### pending_condition

「何が起きたら、このタスクを再び動かすか」。

これがないと後日、

「なんでpendingなんだっけ？」

という再判断が発生する。

### review_date

条件が発生しなくても、指定日に強制的に再確認する。

review_date 到来時に確認すること。

- まだやる理由があるか
- 今なら動けるか
- 自分がやる必要があるか
- `todo` に戻すか
- `cancel` にするか

---

## 6. GTDとの対応

| Youkan | 日本語 | GTDで近い考え方 |
|---|---|---|
| `inbox` | 未整理 | Inbox |
| `todo` | 順番待ち | Next Actions |
| `focus` | 今日やる | Next Actionsから今日選択 |
| `waiting` | 相手待ち | Waiting For |
| `pending` | 条件・時期待ち | Someday/Maybe / Tickler |
| `done` | 完了 | Completed |
| `cancel` | 中止・見送り | Trash |

GTDをそのまま再現するのではなく、晴樹が迷わない状態数まで圧縮する。

---

## 7. アイゼンハワーマトリクスの位置付け

アイゼンハワーマトリクスはstatusにはしない。

statusは、

**「このタスクは今どんな状態か」**

重要度・緊急度は、

**「todoの中から何をfocusへ上げるか」**

を決める補助軸。

| 重要度・緊急度 | システム側の扱い |
|---|---|
| 重要 × 緊急 | `focus` 候補 |
| 重要 × 緊急でない | `todo` で守る。目安期日を持つ |
| 重要でない × 緊急 | まず相談・委任を検討。任せたら `waiting` |
| 重要でない × 緊急でない | `cancel` 候補 |

緊急度はなるべく手入力せず、納期・目安期日からシステム側で算出する。

---

## 8. 晴樹向け「重要」の判断軸

単なる売上・緊急度だけで判断しない。

- 2026年の大目標につながるか
- 晴樹本人しかできない仕事か
- 人に相談・委任できないか
- 作家として語れる仕事か
- 美意識としてやりたいか
- 5年後に作品集へ載せたいか

これらを毎タスク入力させるより、番頭側が `focus` 候補を絞る判断材料として使う。

---

## 9. 大目標・作家性を思い出させるタイミング

常時入力項目として表示するより、節目で確認する。

### inbox → todo の整理時

- 2026年の大目標につながる？ Yes / No
- 5年後、作品集に載せたい？ Yes / No
- 自分がやる必要がある？ Yes / No

### review_date 到来時

- まだやる理由がある？ Yes / No
- 自分がやる必要がある？ Yes / No

タスク管理自体を「方向性を思い出す仕組み」にする。

---

## 10. データ構造イメージ

最小構成。

```yaml
status: inbox | todo | focus | waiting | pending | done | cancel

due_date: null
estimate_date: null

review_date: null
pending_condition: null

importance: null
```

追加検討候補。

```yaml
goal_link: null
artist_value: null
delegatable: null
scheduled_at: null
```

ただし入力項目は増やしすぎない。

可能なものは晴樹が入力するのではなく、番頭・システム側が推定・提案する。

---

## 11. 現時点の設計思想

1. 状態を増やしすぎない
2. statusは「今どんな状態か」だけを表す
3. 優先順位は別軸にする
4. `todo` は「やると決めた順番待ち」
5. `waiting` は人待ち
6. `pending` は条件・時期待ち
7. `pending` には `pending_condition` と `review_date`
8. 重要度・緊急度は `focus` 選定に使う
9. 大目標・作家性・委任可能性を節目で思い出させる
10. 晴樹自身が分類・採点しすぎず、番頭が判断補助する
11. 1日の `focus` は4時間以内

---

## 12. 次に詰めたい論点

- statusを7種類で確定するか
- `pending` とSomeday/Maybeを完全に同一視するか
- `review_date` 到来時の通知・復帰ロジック
- `importance` を手入力にするか番頭判定にするか
- 大目標・作家性をフィールド化するか、レビュー質問だけにするか
- `todo` から `focus` を自動推薦するロジック

## 20260818 05:04 追記
### 質問
decision_hold　判断保留って　なくしたけど、でもそういう場合もあるよね？それをinboxに置きっぱなしにすればいいよでいいのかな？

### 回答
inboxに置きっぱなしは、あまり良くない。inboxは「まだ整理してない」箱だから、「今は決めない」と判断した時点で整理済み。

俺なら decision_hold は復活させず、pending に吸収する。
例：pending_condition: 展示会の全体予算が見えてから判断、review_date: 2026-09-15。

つまり pending を「実行条件待ち」だけでなく、判断条件待ちまで含む箱にする。これなら状態を増やさず、「なぜ保留か」「いつ再判断するか」も残せる。