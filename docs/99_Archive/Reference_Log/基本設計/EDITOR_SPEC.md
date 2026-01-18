# Editor Module Specification (External View)

> [!NOTE]
> 本書は **External View (Editor/Project Management)** レイヤーの詳細仕様である。
> システム全体のアーキテクチャおよび Internal View (JBWOS) については `BASIC_DESIGN_JBWOS.md` および `CONSTITUTION_UI_SPEC.md` を参照のこと。

# JWCAD建具表作成Web (Software Definition)

## 1. プロジェクト概要 (Concept)
**「Visual First, Detail on Demand」**
設計士、建具店、工務店のために、直感的なビジュアル操作で建具を設計し、JWCAD用データおよび建具表を作成・管理できるWebアプリケーション。
完全ローカルファースト（サーバーレス）で動作し、高速かつセキュア、そしてランニングコストゼロを実現する。

## 2. アーキテクチャ (Architecture)
### 完全ローカルファースト (Local-First)
*   **Serverless**: バックエンドサーバーを持たない。全てのロジックはブラウザ上のJavaScriptで実行される。
*   **Persistence**: データはブラウザの `IndexedDB` に保存。永続化はユーザー自身のデバイス内で行われる。
*   **Zero Visibility**: 開発・運営側はユーザーデータ（顧客リスト、設計データ）を一切保持・閲覧しない。これにより情報漏洩リスクを排除する。

## 3. 技術スタック (Tech Stack)
*   **Frontend**: React (v18+)
*   **Language**: TypeScript (v5+)
*   **Build Tool**: Vite
*   **Styling**: Tailwind CSS (Premium Glassmorphism Design)
*   **State Management**: React Context + Custom Hooks (MVVM)
*   **Database**: Dexie.js (IndexedDB wrapper)
*   **Icons**: Lucide React
*   **Deployment**: GitHub Pages

## 4. UI/UX 設計 (Screens)

### 4.1 ダッシュボード (Home / Dashboard)
アプリケーションの入り口。
*   **Template Gallery (Main)**:
    *   **Standard**: プリセットされた標準テンプレート（フラッシュ、框、障子など）。
    *   **My Templates**: ユーザーが自分で保存したカスタムテンプレート。
    *   **Premium**: (Future) ロックされた有料テンプレート。
*   **Recent Projects (Side)**: 編集中の案件リスト。最終更新順。
*   **Action**: テンプレートをクリックして「新規作成(Editor)」へ遷移。

### 4.2 エディタ画面 (Editor / Workspace)
3カラムレイアウトを採用。
*   **Left Panel (Parameters)**:
    *   **Basic**: 寸法 (W, H)、見付、見込みなどの基本パラメータ。数値を入力。
    *   **Detail**: アコーディオン開閉式の詳細設定（チリ、クリアランス、中桟位置など）。
*   **Center Panel (Preview)**:
    *   **Canvas**: リアルタイム描画される建具のプレビュー。
    *   **Visual Feedback**: 寸法変更に即座に追従。エラー時は赤枠表示など。
*   **Right Panel (Actions & Output)**:
    *   **Output**: [JWCADコピー], [画像保存], [JSONエクスポート]。
    *   **Estimation**: 「参考原価」の表示（Pro版ロック時はモザイク）。
    *   **Save**: [案件保存], [テンプレートとして保存]。

### 4.3設定・Pro解除 (Settings / Modal)
*   **Global Settings**: デフォルトレイヤー、線の色などのJWCAD書式設定。
*   **Unlock Pro**: 解除コード入力フォーム。

## 5. 機能仕様 (Functional Specs)

### 5.1 コアロジック (Domain Logic)
*   入力された寸法 (`DoorDimensions`) に基づき、幾何形状 (`IGeometry`) を生成する。
*   C#版のロジック (`GeometryGenerator`) をTypeScriptに完全移植する。

### 5.2 データ永続化 (Persistence)
*   **Dexie.js** を使用し、以下のスキーマで保存。
*   **Projects**: 案件データ。複数のDoorを持つ。
*   **Doors**: 建具および製作物アイテム（Category: Door, Frame, Furniture, Hardware）。
*   **Templates**: ユーザー定義のテンプレート。
*   **Settings**: アプリ設定。
*   **FieldNotes**: 現場野帳データ。

### 5.3 JWCAD連携 (Integration)
*   **Clipboard Copy**: JWCADの「文字貼付」コマンド等で利用可能なフォーマットのテキストをクリップボードに書き込む。
*   **Format**: 基本はJWCAD外部変形形式のデータ構造（線分データ）を出力。

### 5.4 マネタイズ制御 (Monetization)
*   **Pro Lock**:
    *   原価積算ロジックはクライアントサイドに含まれるが、UI上でマスクされる。
    *   正しいパスワード（ハッシュ照合）が入力されると、`localStorage` にフラグが立ち、マスクが解除される。

## 6. データモデル (Data Models)

```typescript
// 建具の寸法定義
interface DoorDimensions {
  width: number;
  height: number;
  stileWidth: number;      // 縦框見付
  topRailWidth: number;    // 上桟見付
  bottomRailWidth: number; // 下桟見付
  middleRailWidth: number; // 中桟見付
  middleRailCount: number; // 中桟本数
  // ...他詳細パラメータ
}

// 建具エンティティ (Extended for Production List)
interface Door extends DoorDimensions {
  id: string;
  projectId: number;
  name: string;      // 符号
  tag: string;       // 管理タグ (D-1, M-1...)
  category?: 'door' | 'frame' | 'furniture' | 'hardware' | 'other'; // [NEW]
  genericSpecs?: { unit: string; note: string }; // [NEW]
  templateId?: string; // 元になったテンプレートID
  createdAt: number;
  updatedAt: number;
}

// 案件（プロジェクト）
interface Project {
  id: string;
  name: string;      // 案件名
  doors: Door[];
  updatedAt: number;
}
```

## 7. ロードマップ (Roadmap)

### Phase 1: MVP (Core Features) - 2 Weeks
*   プロジェクトセットアップ (Vite+React+TS)。
*   コアロジック移植 (GeometryGenerator)。
*   エディタ画面（プレビュー、パラメータ変更）。
*   JWCADクリップボードコピー実装。

### Phase 2: Persistence & Usability - 2 Weeks
*   Dexie.js 導入、案件保存・読出。
*   テンプレートギャラリー実装。
*   UIデザイン研磨 (Glassmorphism)。

### Phase 3: Monetization & Release - 2 Weeks
*   原価積算ロジック実装。
*   Pro版ロック画面・解除コード実装。
*   Note/Gumroadでの販売準備。
*   マーケティングAI（自動スクショ・記事作成）実装。

## User Review Required
> [!IMPORTANT]
> サーバーサイドの実装は一切行いません。全てのデータはユーザーのブラウザ内にのみ存在します。機種変更時等のデータ移行は、手動でのファイルエクスポート/インポートが必要です。

