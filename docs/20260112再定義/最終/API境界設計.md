# API境界設計（UI/UX前提） v1.0
最終更新: 2026-01-12 (JST)

本ドキュメントは、UI/UX設計を前提とした**APIの責務分離とエンドポイント定義**を示す。

---

## 1. API設計原則

1. UIは判断しない
2. APIは決定済みの事実のみ受け取る
3. RDD・分類・優先はサーバ責務
4. 1操作 = 1意味

---

## 2. レイヤ構成

```
UI → BFF(Application API) → Domain Service → DB
```

UIはBFFのみを呼び出す。

---

## 3. Today API

### GET /today
Today画面描画用の集約DTOを返す。

### POST /today/commit
Commitを確定する。

---

## 4. Inbox API

### POST /inbox
Inboxへ放り込む。

### POST /inbox/{id}/convert
Inbox項目をDecision/Life等へ変換。

---

## 5. Decision / GDB API

### GET /gdb
RDD到達済みの未解決Decisionを返す。

### POST /decision/{id}/resolve
DecisionをYes/Noで確定。

---

## 6. Execution API

### GET /execution
ActiveなExecutionContextと次Blockを返す。

### POST /execution/block/{id}/complete
ExecutionBlockを完了。

---

## 7. Life API

### POST /life/{id}/check
Lifeタスクの完了チェック。

---

## 8. 禁止API（思想違反）

- GET /tasks
- POST /prioritize
- POST /schedule
- PUT /execution/select-block

---
