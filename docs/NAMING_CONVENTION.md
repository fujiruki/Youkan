# Youkan プロジェクト 命名規約 (Naming Convention)

本ドキュメントは、AIエージェントによる自動開発・協調開発において、命名の不整合を排除し、コードの理解性と保守性を最大化するためのガイドラインです。

---

## 1. 基本指針
- **標準語彙の優先**: AIが一般的・業界標準的と判断できる具体的かつ明確な英単語を使用する。
- **抽象表現・比喩の禁止**: 独自の比喩や抽象的な名前を避け、第三者の開発者が直感的に意味を理解できる名前を付ける。
- **ドメイン一貫性**: `JBWOS` 特有の名前は避け、プロダクト名が必要な場合は `Youkan`、機能単位ではドメイン名（`quantity`, `auth`, `project` 等）を優先する。

## 2. 変数・プロパティ命名規則

| 対象層 | 規則 | 例 |
| :--- | :--- | :--- |
| **Frontend (TypeScript/JS)** | `camelCase` | `estimatedMinutes`, `manHours`, `isArchived` |
| **Backend (PHP / SQL)** | `snake_case` | `estimated_minutes`, `man_hours`, `is_archived` |

### データ境界（Repository層）の扱い
Frontend と Backend で命名規則が異なるため、`Repository` または `ApiClient` における変換処理を**必須・明示的**に行うこと。AIエージェントはマッピング漏れがないよう厳密にチェックすること。

## 3. ファイル命名規則

| カテゴリ | 形式 | 例 |
| :--- | :--- | :--- |
| **React Component** | `PascalCase.tsx` | `DecisionDetailModal.tsx` |
| **Custom Hooks** | `useCamelCase.ts` | `useJBWOSViewModel.ts` |
| **Class / Service** | `PascalCase.ts` | `QuantityEngine.ts` |
| **Functions / Utils** | `camelCase.ts` | `dateUtils.ts` |
| **Style (CSS)** | `PascalCase.css` | `DecisionDetailModal.css` (コンポーネント用) |

## 4. 特殊なケース・サフィックス

### 4.1 日付と時刻
- **日付文字列 (YYYY-MM-DD)**: `~Date` または `~Day` (例: `dueDate`, `workDay`)
- **タイムスタンプ / 時刻**: `~At` または `~Time` (例: `updatedAt`, `startTime`)

### 4.2 真偽値 (Boolean)
- `is~`, `has~`, `should~`, `can~` 等のプレフィックスを付ける。 (例: `isArchived`, `hasSubTask`)

## 5. AIエージェントへの指示
開発・コーディングを開始する前に、必ずこの規約を確認してください。不整合を発見した場合は、リファクタリングを提案し、常にクリーンな命名状態を保ってください。
