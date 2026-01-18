# Tategu Design Studio - ドキュメント索引

**最終更新**: 2026-01-05

このドキュメントは、プロジェクト全体のドキュメント構成を整理し、目的に応じた参照先を示します。

---

## 📋 目次

1. [建具エディタ関連](#1-建具エディタ関連)
2. [材料積算関連](#2-材料積算関連)
3. [DXF/JWCAD出力関連](#3-dxfjwcad出力関連)
4. [UI/UX設計](#4-uiux設計)
5. [開発ガイド](#5-開発ガイド)
6. [API・データモデル](#6-apiデータモデル)

---

## 1. 建具エディタ関連

### 📄 主要ドキュメント

#### [EDITOR_FUNCTION_SPEC.md](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/docs/EDITOR_FUNCTION_SPEC.md)
**建具エディタの完全機能仕様**

- **自動保存**: 1秒デ��ウンス、変更検知ロジック
- **リセット/アンドゥ**: スナップショット管理、直前状態復元
- **サムネイル生成**: Canvas → Base64 変換、保存タイミング
- **インタラクティブプレビュー**: クリック編集、長押し操作

**対象読者**: 開発者、機能仕様レビュアー

---

### 🔧 関連実装ファイル

| ファイル | 説明 |
|:---|:---|
| [`EditorScreen.tsx`](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/components/Editor/EditorScreen.tsx) | エディタ画面の統合コンポーネント |
| [`Sidebar.tsx`](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/components/Editor/Sidebar/Sidebar.tsx) | 寸法入力サイドバー (Design/Pro モード) |
| [`PreviewCanvas.tsx`](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/components/Editor/PreviewCanvas.tsx) | 2Dプレビュー描画 (Canvas API) |
| [`InteractionOverlay.tsx`](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/components/Editor/InteractionOverlay.tsx) | クリック編集オーバーレイ |
| [`MiniEditor.tsx`](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/components/Editor/MiniEditor.tsx) | ポップアップ数値編集 |
| [`useDoorViewModel.ts`](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/hooks/useDoorViewModel.ts) | ViewModel (MVVM) |

---

### 📐 形状生成ロジック

#### [`GeometryGenerator.ts`](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/logic/GeometryGenerator.ts)
**建具の全部材座標を計算**

- **入力**: `DoorDimensions`
- **出力**: `GeometryResult` (lines, parts)
- **処理内容**:
  - 框 (Stile)、桟 (Rail)、中桟、束、組子の配置計算
  - 中桟位置の手動/自動モード
  - インタラクション用の `GeometryPart` (id, type, x, y, w, h)

**用途**: プレビュー描画、DXF出力、インタラクション判定

---

## 2. 材料積算関連

### 📄 主要ドキュメント

#### [ESTIMATION_LOGIC.md](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/docs/ESTIMATION_LOGIC.md)
**材料積算の完全ロジック仕様**

- **材料リストアップ**: 框、桟、中桟、束、組子の個別計算
- **数量計算**: 本数、幅、厚み、長さ
- **余裕 (マージン)**: 幅方向、長さ方向、厚み方向
- **ホゾ加工**: 片側30mmのデフォルト設定
- **原価計算**: 材積 (m³) × 単価
- **マークアップ**: 利益率 (デフォルト20%)
- **税計算**: 消費税 (デフォルト10%)

**対象読者**: 見積担当者、開発者、現場スタッフ

---

### 🔧 関連実装ファイル

| ファイル | 説明 |
|:---|:---|
| [`EstimationService.ts`](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/domain/EstimationService.ts) | 積算ロジックのコア実装 |
| [`EstimationPanel.tsx`](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/components/Editor/EstimationPanel.tsx) | 積算結果の表示パネル |
| [`EstimationSettings.ts`](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/domain/EstimationSettings.ts) | 単価・税率などの設定型 |
| [`DoorDimensions.ts`](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/domain/DoorDimensions.ts) | 寸法データ型 + オーバーライド |

---

### 📊 積算フロー図

```mermaid
graph LR
    A[DoorDimensions] --> B[EstimationService.calculateCost]
    C[EstimationSettings] --> B
    B --> D[MaterialItem[]]
    B --> E[Summary]
    D --> F[EstimationPanel表示]
    E --> F
```

---

## 3. DXF/JWCAD出力関連

### 📄 主要ドキュメント

#### [DXF_OUTPUT_SPEC.md](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/docs/DXF_OUTPUT_SPEC.md)
**DXF出力の完全仕様 (最新版)**

- **SOLID塗りつぶし**: 部材毎の色分け
- **レイヤー構成**: グループ0 (建具本体)、グループ8 (情報)
- **設定のカスタマイズ**: `DxfLayerConfig` による柔軟な変更
- **複数建具対応**: 横並び配置、座標変換
- **JWCAD利用方法**: 読み込み手順、レイヤー操作

**対象読者**: CADオペレーター、設計者、開発者

---

#### [JWCAD_OUTPUT_SPEC.md](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/docs/JWCAD_OUTPUT_SPEC.md)
**JWCAD出力の初期仕様 (Expert Meeting結果)**

- **用紙レイアウト**: A3横、2×3グリッド
- **グリッド構成**: ヘッダー、描画、スペック
- **人型スケール**: レイヤー5 (今後実装予定)
- **勝手記号**: 開閉方向マーク (今後実装予定)

**対象読者**: 建築設計者、施工管理者

> **Note**: 最新の実装仕様は `DXF_OUTPUT_SPEC.md` を参照してください。

---

### 🔧 関連実装ファイル

| ファイル | 説明 |
|:---|:---|
| [`DxfGenerator.ts`](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/utils/DxfGenerator.ts) | DXFファイル生成エンジン |
| [`DxfConfig.ts`](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/domain/DxfConfig.ts) | レイヤー・色設定の型定義 |
| [`JoineryScheduleScreen.tsx`](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/components/Dashboard/JoineryScheduleScreen.tsx) | 一覧画面 + エクスポートUI |

---

## 4. UI/UX設計

### 📄 Expert Meeting 議事録

#### [EXPERT_MEETING_ROOM.md](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/docs/EXPERT_MEETING_ROOM.md)
**仮想エキスパート会議の運営ルール**

- **参加者ペルソナ**: UI/UXデザイナー、建築家、建具店オーナー、工事管理者、インテリアコーディネーター
- **会議プロトコル**: 議題設定、発言ルール、合意形成
- **開催実績**: JWCAD出力仕様、建具リストUI

---

### 🎨 UI設計関連

> 今後のUI/UX改善時は、Expert Meetingプロトコルを使用してペルソナ視点での議論を実施してください。

---

## 5. 開発ガイド

### 📄 開発ルール

#### [`AI_DEVELOPMENT_RULES.md`](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/AI_DEVELOPMENT_RULES.md)
**AI開発時の遵守事項**

- コーディング規約
- コミットメッセージフォーマット
- ドキュメント管理

---

### 🏗️ アーキテクチャ

**フロントエンド**:
- **フレームワーク**: React + TypeScript
- **状態管理**: useState, custom hooks (MVVM)
- **データベース**: Dexie.js (IndexedDB)
- **スタイリング**: Tailwind CSS

**主要パターン**:
- **MVVM**: ViewModel による状態分離
- **Repository**: データアクセスの抽象化
- **Service**: ビジネスロジックの集約

---

## 6. API・データモデル

### 📦 主要データ型

#### Project
[`db.ts`](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/db/db.ts)

```typescript
interface Project {
    id?: number;
    name: string;
    client?: string;
    settings?: EstimationSettings;
    dxfLayerConfig?: DxfLayerConfig;
    updatedAt: Date;
    createdAt: Date;
}
```

#### Door
```typescript
interface Door {
    id?: number;
    projectId: number;
    tag: string;
    name: string;
    dimensions: DoorDimensions;
    specs: Record<string, any>;
    count: number;
    thumbnail?: string;
    updatedAt: Date;
    createdAt: Date;
}
```

#### DoorDimensions
[`DoorDimensions.ts`](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/domain/DoorDimensions.ts)

```typescript
interface DoorDimensions {
    width: number;
    height: number;
    depth: number;
    stileWidth: number;
    topRailWidth: number;
    bottomRailWidth: number;
    middleRailWidth: number;
    middleRailCount: number;
    middleRailPosition?: number;
    tsukaWidth: number;
    tsukaCount: number;
    kumikoVertWidth: number;
    kumikoVertCount: number;
    kumikoHorizWidth: number;
    kumikoHorizCount: number;
    estimationOverrides?: EstimationOverrides;
}
```

---

## 📌 クイックリファレンス

### 用途別早見表

| やりたいこと | 参照ドキュメント |
|:---|:---|
| **建具の編集機能を理解したい** | [EDITOR_FUNCTION_SPEC.md](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/docs/EDITOR_FUNCTION_SPEC.md) |
| **見積積算のロジックを知りたい** | [ESTIMATION_LOGIC.md](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/docs/ESTIMATION_LOGIC.md) |
| **DXFファイルの仕様を確認したい** | [DXF_OUTPUT_SPEC.md](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/docs/DXF_OUTPUT_SPEC.md) |
| **JWCADで図面を読み込みたい** | [DXF_OUTPUT_SPEC.md § 7](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/docs/DXF_OUTPUT_SPEC.md) |
| **形状生成の計算式を見たい** | [`GeometryGenerator.ts`](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/logic/GeometryGenerator.ts) |
| **積算計算の実装コードを見たい** | [`EstimationService.ts`](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/domain/EstimationService.ts) |
| **UI改善を議論したい** | [EXPERT_MEETING_ROOM.md](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/docs/EXPERT_MEETING_ROOM.md) |

---

## 🔄 ドキュメント更新履歴

| 日付 | 変更内容 |
|:---|:---|
| 2026-01-05 | 索引ドキュメント作成、DXF_OUTPUT_SPEC.md追加 |
| 2025-12-XX | EDITOR_FUNCTION_SPEC.md, ESTIMATION_LOGIC.md作成 |
| 2025-12-XX | Expert Meetingプロトコル策定 |

---

**Document Version**: 1.0.0  
**Maintainer**: Development Team
