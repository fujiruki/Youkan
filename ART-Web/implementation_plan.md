# JWCAD建具表作成Web (JWCADTategu.Web) 実装計画書

## 概要
`SYSTEM_DESIGN_SPECIFICATION.md` に基づく、Webアプリケーションの実装計画。
Vite + React + TypeScript を使用し、ローカルファーストな建築DXツールを構築する。

## User Review Required
> [!IMPORTANT]
> 本計画はサーバーレス・ローカルファースト構成を前提としています。

## Proposed Changes

### Estimation Logic Refactor (M3 Basis)
#### [x] [MODIFY] [EstimationSettings.ts](file:///src/domain/EstimationSettings.ts)
- [x] Add `pricePerM3` to `UnitPrice` interface.
- [x] Default settings to use M3 price (e.g., ¥200,000/m3 for Spruce).

#### [x] [MODIFY] [EstimationService.ts](file:///src/domain/EstimationService.ts)
- [x] `calculateCost` to prioritize `pricePerM3` * `volume` for cost calculation.

#### [x] [MODIFY] [EditorScreen.tsx](file:///src/components/Editor/EditorScreen.tsx)
- [x] Add "Estimation Settings" section to the left sidebar accordion.
- [x] Allow editing `pricePerM3` directly in the sidebar.
- [x] Pass update handler to `EstimationDetailPanel`.

#### [x] [MODIFY] [EstimationDetailPanel.tsx](file:///src/components/Editor/EstimationDetailPanel.tsx)
- [x] Re-introduce `onUpdateSettings`.
- [x] Change "Material Unit Price Base" to an editable input for M3 price.

- [x] Change "Material Unit Price Base" to an editable input for M3 price.

### Joinery Schedule Enhancements
#### [x] [MODIFY] [db.ts](file:///src/db/db.ts)
- [x] Add `settings` to `Project` schema.

#### [x] [MODIFY] [ProjectRepository.ts](file:///src/repositories/ProjectRepository.ts)
- [x] Initialize new projects with `DefaultEstimationSettings`.

#### [x] [MODIFY] [JoineryScheduleScreen.tsx](file:///src/components/Dashboard/JoineryScheduleScreen.tsx)
- [x] Display "Material Cost" and "Total Estimate" per door.
- [x] Allow inline editing of Door Name.
- [x] Allow editing of Project Name in header.

### [Component Name] Web Application Structure
新しいWebアプリケーションプロジェクトを構築します。
ディレクトリ: `/JWCADTategu.Web` (ルート直下に新規作成予定、または現状の構成に合わせて配置)

#### [NEW] Configuration
*   `package.json`: React, TypeScript, Vite, Tailwind CSS, Dexie, Lucide-React
*   `tsconfig.json`
*   `vite.config.ts`
*   `tailwind.config.js`

#### [NEW] Domain Layer (src/domain)
C#から移植される純粋なビジネスロジック。
*   `DoorDimensions.ts`: 建具寸法モデルとバリデーション。
*   `GeometryGenerator.ts`: 描画・出力用幾何計算ロジック。
*   `estimation.ts`: 原価計算ロジック。

#### [NEW] Persistence Layer (src/db)
*   `db.ts`: Dexie.js データベース定義 (Projects, Templates)。

#### [NEW] UI Layer (src/components)
*   `Dashboard/`: ホーム画面、ギャラリー。
*   `Editor/`: 編集画面コンポーネント。
*   `Editor/Preview.tsx`: HTML5 Canvas/SVGによるプレビュー。
*   `Shared/`: 共通UIパーツ (Button, Input, Card)。

#### [NEW] Features (src/features)
*   `jwcad-integration/`: JWCAD形式テキスト生成・クリップボード制御。
*   `marketing/`: 自動スクショ・デモ生成機能。

## Verification Plan

### Automated Tests
*   `vitest` を導入し、`GeometryGenerator` のロジックテストを行う。
*   C#版のテストケースを移植し、同じ入力に対して同じ出力が得られることを検証する。

### Manual Verification
1.  **UI Flow**: ダッシュボード → テンプレート選択 → エディタ → 保存 のフローが通るか。
2.  **JWCAD**: 生成されたテキストをJWCADに貼り付け、寸法・形状が正しいか。
3.  **Persistence**: ブラウザを閉じてもデータが残っているか。
4.  **Monetization**: 正しいパスワードで原価表示がアンロックされるか。
5.  **Estimation**: 立米単価を変更し、原価が連動して変わるか。
