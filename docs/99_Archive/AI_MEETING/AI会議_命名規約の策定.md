# AI専門家会議：命名規約の策定（Youkanプロジェクト）

**日時**: 2026年2月18日
**参加者**: アーキテクトAI, 実装者AI, テスターAI

---

## 1. 背景と目的
Youkanプロジェクト（旧JBWOS）において、命名の不整合（例: `manHours` と `man_hours`）に起因するビルドエラーやバグが発生している。
開発の主体がAIエージェントである現状に鑑み、**「AIが迷わない、かつ誤解しにくい明確なルール」**を策定し、低コストで高品質なコーディングを継続することを目的とする。

## 2. 合意事項（規約案）

### 2.1 変数名とプロパティ名
1. **Frontend (TypeScript)**:
    - 原則として `camelCase` を使用する。
    - 例: `estimatedMinutes`, `manHours`, `isArchived`
2. **Backend (PHP / SQLite)**:
    - 原則として `snake_case` を使用する。
    - 例: `estimated_minutes`, `man_hours`, `is_archived`
3. **データ境界の処理**:
    - Repository層（`ApiClient` または `Repository`）において、バックエンドとの通信時にプロパティ名のマッピング・変換を明示的に行う。コード生成AIは、この変換処理が「必ず存在すべき場所」であることを認識すること。

### 2.2 ファイル命名規則
1. **React Components**: `PascalCase.tsx`（例: `DecisionDetailModal.tsx`）
2. **React Hooks**: `useCamelCase.ts`（例: `useJBWOSViewModel.ts`）
3. **クラス / サービス**: `PascalCase.ts`（例: `QuantityEngine.ts`, `JBWOSRepository.ts`）
4. **ユーティリティ関数群**: `camelCase.ts`（例: `dateUtils.ts`）
5. **スタイル (CSS)**: コンポーネントに紐づく場合は `PascalCase.css`、共通スタイルは `kebab-case.css`

### 2.3 ドメイン用語の統一
- **JBWOSからYoukanへ**: 新しい機能やファイル名では `JBWOS` というプレフィックスを避け、ドメイン名（`quantity`, `auth`, `project` 等）を使用するか、プロダクト名が必要な場合は `Youkan` を使用する。
- **日付**:
    - `YYYY-MM-DD` 形式の文字列: `~Date` または `~Day`（例: `dueDate`）
    - タイムスタンプ（Unix/JS数）：`~At` または `~Time`（例: `updatedAt`, `startTime`）

### 2.4 特記事項：AIフレンドリーであるために
- **具体的かつ一般的な英単語を選択**: メタファーや独自の略称（例: `mHours` ではなく `manHours`）を避け、業界標準の語彙を使用する。
- **型の明示**: TypeScriptにおいて `any` を極力排除し、`types.ts` 等で定義された型を厳格に適用することで、AIの理解を助ける。

## 3. 次のステップ
1. この内容を `docs/NAMING_CONVENTION.md` として正式に文書化する。
2. 以降の開発において、この規約をコンテキストに含め、AIエージェントが順守するように指示する。
