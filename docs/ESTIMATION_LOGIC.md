# 積算ロジックおよび仕様書 (ESTIMATION & GEOMETRY LOGIC)

本ドキュメントは、`TateguJWCADPlugin` および `ART-Plugin` の仕様書に基づき、建具の正確な**原価計算（積算）**および**作図（座標定義）**のロジックを定義したものです。

---

## 1. 原価計算の基本式 (Basic Calculation Formula)

建具の材料費は、加工・製材時のロスを含めた「木取り寸法」に基づく**体積（㎥）**から算出します。

### 1.1 体積計算式
全部材共通で以下の計算式を使用します。

$$
\text{Cost} = \text{Volume}(m^3) \times \text{UnitPrice}(円/m^3) \times \text{Count}
$$

$$
\text{Volume}(m^3) = (\text{Width} + W_{margin}) \times (\text{Thickness} + T_{margin}) \times (\text{Length} + L_{margin} + \text{Hozo}) \times 10^{-9}
$$

*   寸法単位は **mm**、体積は **m³** です。
*   各項目の定義：
    *   **Width (幅)**: 部材の見付寸法。
    *   **Thickness (厚)**: 部材の見込寸法。
    *   **Length (長さ)**: 部材の仕上がり長さ（見え掛かり寸法）。
    *   **Hozo (ホゾ)**: 接合に必要な追加長さ（詳細は3. 部材別詳細にて定義）。
    *   **Margins (余裕)**: 製材・加工ロスを見込んだ設定値（settings.csv等で管理）。

### 1.2 デフォルト余裕値 (Default Margins)
仕様書 (`ESTIMATION_SPEC.md`) に基づく初期値例：
*   **$W_{margin}$ (幅余裕)**: 10mm（框など）
*   **$L_{margin}$ (長余裕)**: 0mm（または設定値）
*   **$T_{margin}$ (厚余裕)**: 0mm（または設定値）

---

## 2. 座標系と基本パラメータ (Coordinate System)

*   **原点**: 左下 (0, 0)
*   **DW**: 建具枠外幅 (Door Width)
*   **DH**: 建具枠外高さ (Door Height)
*   **Sw**: 縦框見付 (Stile Width)
*   **Trw**: 上桟見付 (Top Rail Width)
*   **Brw**: 下桟見付 (Bottom Rail Width)

---

## 3. 部材別詳細定義 (Component Details)

各部材の「作図上の位置（座標）」と「積算上の長さ（ホゾ含む）」の定義は以下の通りです。

### 3.1 縦框 (Stile)
建具の左右を構成するメインの柱。

*   **作図範囲 (Geometry)**:
    *   **左縦框**: $(0, 0)$ ～ $(Sw, DH)$
    *   **右縦框**: $(DW - Sw, 0)$ ～ $(DW, DH)$
*   **積算仕様 (Estimation)**:
    *   **長さ (Length)**: $DH$ (建具高さ)
    *   **ホゾ (Hozo)**: **0mm**
        *   *理由*: 通常、縦框はホゾ穴を受ける側（メス）であるため、長さ方向の追加は不要。

### 3.2 上桟 (Top Rail)
建具最上部の横枠。

*   **作図範囲 (Geometry)**:
    *   $(Sw, DH - Trw)$ ～ $(DW - Sw, DH)$
    *   *備考*: 縦框の間に配置（縦框勝ち）。
*   **積算仕様 (Estimation)**:
    *   **長さ (Length)**: $DW - (Sw \times 2)$
    *   **ホゾ (Hozo)**: **$Sw \times 2$**
        *   *理由*: 両端の縦框を貫通、または突き抜ける長さが必要なため、縦框の見付分を加算。

### 3.3 下桟 (Bottom Rail)
建具最下部の横枠。

*   **作図範囲 (Geometry)**:
    *   $(Sw, 0)$ ～ $(DW - Sw, Brw)$
    *   *備考*: 縦框の間に配置。
*   **積算仕様 (Estimation)**:
    *   **長さ (Length)**: $DW - (Sw \times 2)$
    *   **ホゾ (Hozo)**: **$Sw \times 2$**

### 3.4 中桟 (Middle Rail)
構造補強のための中間の横桟。

*   **作図範囲 (Geometry)**:
    *   X範囲: $Sw$ ～ $DW - Sw$
    *   Y位置: 指定された高さ（または等分割位置）を中心または下端として配置。
*   **積算仕様 (Estimation)**:
    *   **長さ (Length)**: $DW - (Sw \times 2)$ （内法寸法）
    *   **長さ (Length)**: $DW - (Sw \times 2)$ （内法寸法）
    *   **ホゾ (Hozo)**: **$Sw \times 2$**

### 3.4.1 中桟の位置 (Middle Rail Position)
*   **中桟高さ (Middle Rail Height)の指定**:
    *   ユーザーは「中桟の上端から、下桟の下端（床面）までの距離」を指定可能。
    *   指定がない場合（0）は、均等割り付け。
*   **複数本の場合**:
    *   指定された高さ位置に、**一番上の中桟の上端**を合わせる。
    *   2本目以降は、その下に「中桟見付幅」と同じ間隔（またはベタ付け、仕様によるが現状はGap=見付幅とする）で配置。


### 3.5 束 (Tsuka / Vertical Mullion)
桟と桟の間に入れる短い縦材。

*   **作図範囲 (Geometry)**:
    *   X位置: (框間の内法) を等分割する位置など。
    *   Y範囲: 一番下の中桟の下端 ～ 下桟の上端。
*   **積算仕様 (Estimation)**:
    *   **条件**: 中桟が1本以上ある場合のみ計算。中桟がない場合は「なし」。
    *   **長さ (Length)**: (一番下の中桟の下端) ～ (下桟の上端)
    *   **ホゾ (Hozo)**: **$VerticalHozoLength \times 2$**
        *   *デフォルト*: 片側30mm × 2 = **60mm**

### 3.6 組子 (Kumiko / Lattice)
装飾用の細かい格子材。

#### A. 組子・ヨコ (Horizontal Lattice)
*   **作図範囲**: 左右の縦框の間 ($Sw$ ～ $DW - Sw$)
*   **積算仕様**:
    *   **長さ**: $DW - (Sw \times 2)$
    *   **ホゾ**: **$Sw \times 2$** （または設定値）

#### B. 組子・タテ (Vertical Lattice)
*   **作図範囲**: 上桟の下端 ～ （中桟がある場合は）中桟の上端。
*   **積算仕様**:
    *   **長さ**:
        *   **中桟なし**: 上桟下端 ～ 下桟上端
        *   **中桟あり**: 上桟下端 ～ （一番上の）中桟上端
    *   **ホゾ**: **$VerticalHozoLength \times 2$** （デフォルト60mm）

---

## 4. UI 表示要件 (UI Requirements)

積算詳細画面（EstimationGrid）では、上記の計算根拠が明確になるように以下の項目を表示してください。

1.  **部材名**
2.  **仕上がり寸法**: 幅(W) × 厚(T) × 長さ(L)
3.  **計算用加算値**:
    *   ホゾ長 (Hozo)
    *   余裕 (Margin: W/T/L)
4.  **数量 (Count)**
5.  **小計 (Price)**

> **注意**: ユーザーが電卓で `(W+Mw) * (T+Tm) * (L+Lm+Hozo) * 単価` を叩いた時に、画面の金額と完全に一致することが品質基準です。
