# RDD算出ロジック & 複数案件運用 最終仕様
最終更新: 2026-01-12 (JST)

本ドキュメントは以下3点を最終確定する。
1. RDD算出ロジック（コード・API仕様）
2. 建具案件2件が同時進行した場合のTodayの出方
3. 「無理だ」と判断した場合の分岐（延期・断り）

---

## 1. RDD算出ロジック（建具）｜コード・API仕様

### 1.1 前提思想
- RDDは「判断の締切日」である
- 作業開始日・警告日ではない
- Todayに判断を浮上させるためだけに使う

---

### 1.2 入力パラメータ（API）

```json
{
  "projectId": "string",
  "installDate": "YYYY-MM-DD",
  "makeDays": number,
  "materialLeadDays": number,
  "bufferDays": number
}
```

---

### 1.3 算出ロジック（疑似コード）

```ts
function calcRDD(project) {
  const RDD_start =
    installDate
    - bufferDays
    - makeDays

  const RDD_material =
    RDD_start
    - materialLeadDays

  return {
    RDD_material,
    RDD_start
  }
}
```

---

### 1.4 生成されるDecision

- 「材料を確定する」
- 「製作開始を判断する」

※ 作業Decisionは生成しない

---

## 2. 建具案件2件が同時進行した場合のToday

### 2.1 前提
- Today判断枠は最大2件
- 判断の重さ・緊急度で自動選別

---

### 2.2 シナリオ例

#### 案件A
- 取付日：Day14
- RDD_material：Day4
- RDD_start：Day7

#### 案件B
- 取付日：Day10
- RDD_material：Day2
- RDD_start：Day5

---

### 2.3 Day2 朝のToday

1. 案件B｜材料を確定する
2. 案件A｜材料を確定する

→ 判断2件で上限到達  
→ それ以外は出ない

---

### 2.4 Day5 朝のToday

1. 案件B｜製作開始を判断する

※ 案件Aは翌日に送られる  
※ 無理に2件埋めない

---

## 3. 「無理だ」と判断した場合の分岐

### 3.1 判断の種類

DecisionのYes/No/Holdを以下に再定義する。

| 判断 | 意味 |
|----|----|
| Yes | この条件で引き受ける |
| Hold | 条件次第で再検討 |
| No | 今回は無理 |

---

### 3.2 延期（Hold）

#### 条件
- 時間・材料・体力が不足
- ただし将来的可能性あり

#### 振る舞い
- 新RDDを再計算
- Todayからは消える
- GDBに静的に残る

---

### 3.3 断り（No）

#### 条件
- 納期的に不可能
- 既存案件を壊す

#### 振る舞い
- Decisionは完了
- 以後Todayに出ない
- Historyに事実として残る

👉 断ったことを評価しない  
👉 正しい判断として扱う

---

## 4. 思想テスト（必須）

以下にYESなら設計違反。

- RDDがToday以外に表示されているか？
- 作業量でToday判断数が変わるか？
- 「断り」が失敗扱いされているか？

---

## 5. 最終固定宣言

> RDDは  
> **判断を前倒しで終わらせるための内部ロジック**である。

> これを警告・圧・管理に使った瞬間、  
> 本システムは崩壊する。

---

以上。
