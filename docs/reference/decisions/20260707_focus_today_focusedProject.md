# focus / Today / focusedProject の概念分離

Date: 2026-07-07
Status: Accepted

## 決定

Youkan では `focus`、Today、focusedProject を別の軸として扱う。

## 定義

- `status = focus`: アイテムの永続状態。「やる判断済み」「実行候補」「日程・量感の対象になり得る」ことを表す。
- Today: 当日の実行キュー。`executionItem`、`todayCommits`、`todayCandidates` で表現する。「今日の約束」は Today に入ったものだけに発生する。
- `focusedProjectId` / `activeProject`: 表示・入力・量感計算のプロジェクト文脈。特定プロジェクト配下の表示、追加アイテムの所属継承、量感母集団の絞り込みに使う。

## 注意

`status = focus` のアイテムは Today に入っているとは限らない。Today 上のアイテムは多くの場合 `focus` だが、両者は同義ではない。

`focusedProject` は「プロジェクトを見ている/文脈にしている」という意味であり、アイテム状態の `focus` とは無関係である。

## 表示条件への含意

- 全体一覧・ガント・量感カレンダーでは、削除済み・アーカイブ済み・`trash`・`archive`・`someday`・完了系を除外したうえで、`focus` だが Today ではない未完了アイテムも有効アイテムとして扱う。
- Stream の Inbox など、「未判断の入口」を表す場所では `focus` を混ぜない。
