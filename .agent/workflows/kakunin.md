---
description: 実装前に計画を確認し、ユーザーの承認（OK）を待つワークフロー
---

1. 計画を策定し、`implementation_plan.md` や `task.md` を更新します。
2. ユーザーに計画を提示し、確認を求めます。
 
-> [!CAUTION]
-> **AIへの絶対命令: ShouldAutoProceed を True にしないこと**
-> `notify_user` ツールを呼び出す際、`ShouldAutoProceed` 引数に **絶対に `true` を指定してはいけません**。
-> たとえ「明白な合意がある」とAIが判断しても、このワークフローが適用されている間は `false` を維持してください。
+
+### 自己チェックリスト (ツール実行前に確認)
+- [ ] `BlockedOnUser` は `true` になっているか？
+- [ ] `ShouldAutoProceed` は **「意図的に」** `false` になっているか？
+- [ ] 計画へのリンク（[implementation_plan.md]が含まれているか？
 
 > [!IMPORTANT]
 > **この手順で必ず停止してください**
 10: > ユーザーが明示的に「OK」「進めてよし」と言うまで、**絶対に** 次のステップ（実装）に進んではいけません。

```python
# ユーザーの承認待ち
notify_user(
    Message="計画を作成しました。内容をご確認ください。問題なければ実装に進みますが、よろしいでしょうか？（このワークフローでは、あなたの承認があるまで待機します）",
    BlockedOnUser=true,
    ShouldAutoProceed=false # CRITICAL: Must be false to stop auto-execution
)
```