export type MaterialType = 'wood' | 'glass' | 'shoji' | 'paper' | 'none';
export type GrainDirection = 'vertical' | 'horizontal'; // 木目の向き
export type GrainType = 'masame' | 'itame'; // 柾目 / 板目

export interface MaterialTexture {
    material: MaterialType;
    color?: string;       // ベースカラー (HEX)
    grainDir?: GrainDirection;
    grainType?: GrainType;
    opacity?: number;     // 透明度 (0.0 - 1.0)
    roughness?: number;   // 表面の粗さ（将来用）
}

// 部位ごとのテクスチャ設定
export interface DoorTextureSpecs {
    stile: MaterialTexture;       // 縦框
    topRail: MaterialTexture;     // 上桟
    bottomRail: MaterialTexture;  // 下桟
    middleRail: MaterialTexture;  // 中桟
    tsuka: MaterialTexture;       // 束
    kumiko: MaterialTexture;      // 組子
    panel: MaterialTexture;       // 鏡板
    glass: MaterialTexture;       // ガラス
}

// カタログアイテム定義
export interface CatalogItem {
    id: string; // UUID
    name: string;
    category: string;
    keywords: string[];
    doorData: any; // Door エンティティの完全なコピー (型循環回避のため any としているが本来は Door)
    thumbnail: string; // Base64 Data URL
    createdAt: number;
    updatedAt: number;
}

// デフォルトのマテリアル設定
export const defaultTextureSpecs: DoorTextureSpecs = {
    stile: { material: 'wood', grainDir: 'vertical', grainType: 'masame', color: '#e6cca0' },
    topRail: { material: 'wood', grainDir: 'horizontal', grainType: 'masame', color: '#e6cca0' },
    bottomRail: { material: 'wood', grainDir: 'horizontal', grainType: 'masame', color: '#e6cca0' },
    middleRail: { material: 'wood', grainDir: 'horizontal', grainType: 'masame', color: '#e6cca0' },
    tsuka: { material: 'wood', grainDir: 'vertical', grainType: 'masame', color: '#e6cca0' },
    kumiko: { material: 'wood', grainDir: 'vertical', grainType: 'masame', color: '#e6cca0' },
    panel: { material: 'wood', grainDir: 'vertical', grainType: 'itame', color: '#dcb880' },
    glass: { material: 'glass', opacity: 0.3, color: '#a0e0ff' }
};
