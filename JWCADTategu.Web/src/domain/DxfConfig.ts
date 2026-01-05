/**
 * DXF Layer Configuration
 * Allows customization of layer assignments for DXF export
 */
export interface DxfLayerConfig {
    // Joinery elements (Layer Group 0)
    joineryOutline: string;      // Default: '0-2' (Group 0, Layer 2)
    joineryFill: string;          // Default: '0-E' (Group 0, Layer E)

    // Information elements (Layer Group 8)
    dimensions: string;           // Default: '8-F' (Group 8, Layer F)
    text: string;                 // Default: '8-0' (Group 8, Layer 0)
    frame: string;                // Default: '8-1' (Group 8, Layer 1)
}

export const DEFAULT_DXF_LAYER_CONFIG: DxfLayerConfig = {
    joineryOutline: '0-2',
    joineryFill: '0-E',
    dimensions: '8-F',
    text: '8-0',
    frame: '8-1'
};

/**
 * DXF Color Palette for joinery parts
 */
export interface DxfColorConfig {
    stile: number;           // 框 (Default: 150 - brown)
    rail: number;            // 桟 (Default: 150 - brown)
    kumiko: number;          // 組子 (Default: 200 - light wood)
    tsuka: number;           // 束 (Default: 180 - medium wood)
    glass: number;           // ガラス (Default: 140 - light blue)
    panel: number;           // 板 (Default: 160 - natural wood)
}

export const DEFAULT_DXF_COLOR_CONFIG: DxfColorConfig = {
    stile: 150,
    rail: 150,
    kumiko: 200,
    tsuka: 180,
    glass: 140,
    panel: 160
};
