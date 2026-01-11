# DXF出力機能 完全仕様書

## 概要

本機能は、Tategu Design Studioで作成された建具データを、JWCAD互換の **DXF形式 (R12 COMPATIBLE)** として出力します。
ソリッド塗りつぶし図形を使用し、詳細な部材構成を視覚的に表現します。

**最終更新**: 2026-01-05

---

## 1. 出力形式

### 1.1 基本仕様
- **フォーマット**: ASCII DXF R12
- **単位**: ミリメートル (mm)
- **座標系**: Y軸上向き (CAD標準)
- **エンティティ**: LINE, SOLID, TEXT

### 1.2 ファイル構成
- **HEADER**: バージョン情報 (AC1009)、単位設定
- **TABLES**: レイヤー定義
- **ENTITIES**: 図形データ (LINE, SOLID, TEXT)

---

## 2. レイヤー構成

### 2.1 レイヤーグループ体系

#### **レイヤーグループ 0** - 建具本体
建具の形状と塗りつぶしを表現。

| レイヤー名 | 用途 | エンティティ | 色 |
|:---|:---|:---|:---|
| `0-2` | 建具枠線（輪郭） | LINE | 7 (白/黒) |
| `0-E` | ソリッド塗りつぶし | SOLID | 部材別 (*) |

**(*) 部材別色設定 (デフォルト)**:
- 框 (Stile): 150 (茶色)
- 桟 (Rail): 150 (茶色)
- 組子 (Kumiko): 200 (明るい木目)
- 束 (Tsuka): 180 (中間木目)
- ガラス: 140 (水色)
- 板: 160 (ナチュラル木目)

#### **レイヤーグループ 8** - 情報・注釈
寸法線、テキスト、全体枠など。

| レイヤー名 | 用途 | エンティティ | 色 |
|:---|:---|:---|:---|
| `8-F` | 寸法図形 | LINE | 4 (シアン) |
| `8-0` | テキスト情報 | TEXT | 4 (シアン) |
| `8-1` | 全体枠線 | LINE | 7 (白/黒) |

### 2.2 レイヤー設定のカスタマイズ

プロジェクト毎に、`DxfLayerConfig` インターフェースを使用してレイヤー名を変更可能。

**設定項目**:
```typescript
interface DxfLayerConfig {
    joineryOutline: string;  // デフォルト: '0-2'
    joineryFill: string;     // デフォルト: '0-E'
    dimensions: string;      // デフォルト: '8-F'
    text: string;            // デフォルト: '8-0'
    frame: string;           // デフォルト: '8-1'
}
```

**設定方法**:
プロジェクトの `dxfLayerConfig` プロパティに設定オブジェクトを格納。

---

## 3. 図形描画仕様

### 3.1 SOLID エンティティ (塗りつぶし)

**特徴**:
- 4点の多角形として定義
- 部材タイプに応じた色を自動適用
- GeometryGeneratorから取得した `GeometryPart` を元に生成

**描画プロセス**:
1. `DoorGeometryGenerator.generate()` で全部材の座標を取得
2. 各 `GeometryPart` (x, y, w, h) を取得
3. Y座標を反転 (Canvas座標 → CAD座標)
4. `addFilledRect()` でSOLIDエンティティを追加

**コード例**:
```typescript
geometry.parts.forEach(part => {
    const color = getPartColor(part.type, colorConfig);
    const dxfY = height - part.y - part.h;
    dxf.addFilledRect(
        offsetX + part.x,
        dxfY,
        part.w,
        part.h,
        layerConfig.joineryFill,
        color
    );
});
```

### 3.2 LINE エンティティ (枠線)

**用途**:
- 建具各部材の輪郭線
- 全体枠
- 寸法補助線

**描画位置**:
- 部材輪郭: 各SOLIDの外周
- 全体枠: 建具の外形矩形
- 寸法線: 建具下部(-150mm)と左側(-150mm)

### 3.3 TEXT エンティティ (文字)

**配置内容**:
1. **建具タグ** (例: D-1): 建具上部+350mm
2. **建具名称**: タグの右側
3. **寸法値**: 寸法線の中央
4. **仕様情報**: 建具下部-400mm (将来拡張)

**フォント設定**:
- 高さは明示的に指定 (40mm〜80mm)
- JWCAD側でMSゴシック推奨

---

## 4. 複数建具の配置

### 4.1 横並び配置

**レイアウト**:
- 建具間隔: 2000mm (GAP定数)
- offsetX を累積加算
- 各建具は独立した座標系で描画

**配置例**:
```
[Door1]  GAP(2000mm)  [Door2]  GAP  [Door3]
```

### 4.2 座標変換

**重要**: 各建具毎にY座標反転を実施。

```typescript
doors.forEach(door => {
    const { width, height } = door.dimensions;
    // ...各建具の描画処理...
    offsetX += width + GAP;
});
```

---

## 5. 実装詳細

### 5.1 主要ファイル

| ファイル | 役割 |
|:---|:---|
| [`DxfGenerator.ts`](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/utils/DxfGenerator.ts) | DXFファイル生成エンジン |
| [`DxfConfig.ts`](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/domain/DxfConfig.ts) | レイヤー・色設定の型定義 |
| [`JoineryScheduleScreen.tsx`](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/components/Dashboard/JoineryScheduleScreen.tsx) | UI統合（エクスポートボタン） |

### 5.2 クラス構造

**DxfGenerator クラス**:
```typescript
export class DxfGenerator {
    private lines: string[];
    private layerConfig: DxfLayerConfig;
    private colorConfig: DxfColorConfig;

    constructor(layerConfig?, colorConfig?)
    
    // Public Methods
    public addLine(x1, y1, x2, y2, layer, color?)
    public addSolid(x1, y1, x2, y2, x3, y3, x4, y4, layer, color)
    public addFilledRect(x, y, w, h, layer, color)
    public addText(x, y, text, height, layer)
    public generate(): string
}
```

### 5.3 エクスポート関数

**generateDoorDxf()**:
```typescript
export const generateDoorDxf = (
    doors: Door[], 
    layerConfig?: DxfLayerConfig, 
    colorConfig?: DxfColorConfig
): string
```

**処理フロー**:
1. DxfGeneratorインスタンス生成
2. 各建具をループ:
   - GeometryGenerator で部材座標取得
   - SOLID描画 (塗りつぶし)
   - LINE描画 (枠線)
   - TEXT描画 (タグ、寸法)
   - offsetX を次の建具位置へ移動
3. DXF文字列を返却

---

## 6. UI統合

### 6.1 出力ボタン

**配置**: 建具一覧画面 (JoineryScheduleScreen) のヘッダー右側

**動作**:
1. ボタンクリック → `handleExportDxf()` 実行
2. 検索フィルタ後の建具リスト (`filteredDoors`) を出力
3. プロジェクトの `dxfLayerConfig` を使用（未設定時はデフォルト）
4. Blob生成 → ダウンロード

**ファイル名形式**:
```
{プロジェクト名}_{日付}.dxf
例: MyProject_2026-01-05.dxf
```

### 6.2 将来の拡張機能

**TODO**:
- [ ] 出力オプションダイアログ
  - [ ] レイヤー設定のカスタマイズUI
  - [ ] 色設定のプレビュー
  - [ ] 原価情報の含有/除外
  - [ ] 人型スケールの追加
- [ ] バッチ出力 (複数プロジェクト)
- [ ] JWW形式への直接変換

---

## 7. JWCAD での利用方法

### 7.1 ファイル読み込み

1. JWCAD を起動
2. **ファイル → 開く**
3. ファイル形式を **DXF** に変更
4. 生成された `.dxf` ファイルを選択

### 7.2 レイヤー操作

- **レイヤー一覧**: レイヤーバーで確認
- **表示/非表示**: レイヤー名をクリック
- **レイヤーグループ切替**: グループ番号 (0 or 8) をクリック

### 7.3 推奨設定

- **線色**: 画面の背景色に応じて調整
- **線幅**: 0.13mm〜0.25mm (印刷用)
- **フォント**: MSゴシック (等幅)

---

## 8. トラブルシューティング

### 8.1 塗りつぶしが表示されない

**原因**: JWCADの設定で「ソリッド」が無効化されている。

**解決方法**:
1. **表示 → ソリッド表示** をON
2. レイヤー `0-E` が表示状態か確認

### 8.2 複数建具が重なって見える

**原因**: offsetX の計算ミス、またはY座標反転の不具合。

**解決方法**:
- 最新版のコードを使用 (2026-01-05以降)
- ブラウザのキャッシュクリア後、再出力

### 8.3 文字が文字化けする

**原因**: DXFのTEXTエンティティは文字コード依存。

**解決方法**:
- JWCADで **環境設定 → 文字 → 外部文字** を確認
- UTF-8対応のJWCADバージョンを使用

---

## 9. 関連ドキュメント

- [建具エディタ機能仕様](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/docs/EDITOR_FUNCTION_SPEC.md)
- [材料積算ロジック](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/docs/ESTIMATION_LOGIC.md)
- [形状生成ロジック](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/logic/GeometryGenerator.ts)

---

## 付録: DXFフォーマット詳細

### A.1 SOLID エンティティの構造

```
0
SOLID
8
{layer_name}
62
{color_code}
10
{x1}
20
{y1}
11
{x2}
21
{y2}
12
{x3}
22
{y3}
13
{x4}
23
{y4}
```

**ポイント**:
- 点の順序: 左下 → 右下 → 右上 → 左上
- 色コード (62): AutoCAD Color Index (ACI)

### A.2 レイヤー定義の構造

```
0
LAYER
2
{layer_name}
70
0
62
{color_code}
6
CONTINUOUS
```

---

**Document Version**: 1.0.0  
**Author**: AI Development Team  
**Last Updated**: 2026-01-05
