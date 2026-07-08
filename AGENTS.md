# Youkan Agent Instructions

このリポジトリで作業するエージェントは、最初に以下を読むこと。

1. `docs/AGENT_LOOP_ENGINEERING.md`
2. `docs/SPEC.md`
3. 関連する `docs/SPEC/*.md`
4. 必要に応じて `docs/reference/vision/` と `docs/reference/decisions/`

## 作業ループ

Youkan では、単発プロンプトではなくループ仕様として作業する。

1. Trigger: ユーザー依頼、失敗テスト、仕様差分、レビュー指摘を開始条件にする。
2. Goal: 何が満たされれば完了かを、できるだけテスト・ビルド・仕様差分で定義する。
3. Execute: 仕様を先に更新し、既存パターンに沿って最小限の実装を行う。
4. Verify: `npm.cmd test -- --run ...`、`npm.cmd run build`、必要なら PHP/DB/API の確認を実行する。
5. Stop: success / no-op / blocked / exhausted を明確にして止まる。
6. Memory: 仕様変更は `docs/SPEC/06_変更履歴.md`、作業引き継ぎは `docs/handover/` に残す。

## Youkan 固有ルール

- 仕様書先行。挙動を決めたら `docs/SPEC` に反映してから実装する。
- 量感カレンダーは `docs/SPEC/02_機能仕様.md` の F-06 を正とする。
- Windows PowerShell では `npm` ではなく `npm.cmd` を使う。
- 文字化けして見えるファイルは、まず `-Encoding utf8` で読み直す。
- 既存のユーザー変更は戻さない。
- サブエージェントは、独立した調査・レビュー・検証に限定して使う。実装者と検証者を分ける価値がある時だけ使う。

## デプロイ

- Youkan の本番デプロイは root の `upload.ps1` を使う。
- `deploy.ps1` は `TateguDesignStudio` 向けなので Youkan には使わない。
- PowerShell 実行ポリシーで止まる場合は次を使う。

```powershell
powershell -ExecutionPolicy Bypass -File .\upload.ps1
```

- `upload.ps1` は `npm.cmd run build`、backend と `JWCADTategu.Web/dist` の tar 化、ConoHa への SSH/SCP、展開までを行う。
- デプロイ先は `public_html/door-fujita.com/contents/Youkan`。
