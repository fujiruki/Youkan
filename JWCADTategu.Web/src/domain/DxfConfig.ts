import { DoorDimensions } from './DoorDimensions';

/**
 * JWCAD Layer Group Scale Configuration
 * 
 * Each group has a scale factor that JWCAD applies when displaying.
 * DXF files are drawn at actual size (mm), and JWCAD scales them based on group.
 */
export interface LayerGroupScale {
    group: string;      // Group number (0-9, F)
    scale: number;      // Scale factor (e.g., 0.02 for 1/50)
    displayScale: string; // Display name (e.g., "1/50")
    maxDimension: number; // Maximum door dimension for this group (mm)
}

/**
 * Available layer group scales, ordered from largest to smallest scale.
 * Selection algorithm tries larger scales first for better visibility.
 */
export const LAYER_GROUP_SCALES: LayerGroupScale[] = [
    { group: '4', scale: 0.5, displayScale: '1/2', maxDimension: 120 },   // Tiny: ~120mm
    { group: '3', scale: 0.2, displayScale: '1/5', maxDimension: 300 },   // Small: ~300mm
    { group: '2', scale: 0.1, displayScale: '1/10', maxDimension: 600 },   // Compact: ~600mm
    { group: '1', scale: 0.05, displayScale: '1/20', maxDimension: 1200 },  // Standard: ~1200mm
    { group: '0', scale: 0.02, displayScale: '1/50', maxDimension: 3000 },  // Large: ~3000mm
    { group: '5', scale: 0.01, displayScale: '1/100', maxDimension: 6000 },  // XLarge: ~6000mm
];

/**
 * Frame/dimension layer group - always 1/1 (actual size)
 */
export const FRAME_LAYER_GROUP = 'F';

/**
 * Select appropriate layer group based on door dimensions.
 * Uses largest scale that fits the door within A3 cell constraints.
 * 
 * @param dimensions Door dimensions
 * @param cellWidth Available cell width (mm) - default 97.5mm (130mm * 0.75)
 * @param cellHeight Available cell height (mm) - default 60mm (80mm * 0.75)
 * @returns Selected layer group scale
 */
export function selectLayerGroupForDoor(
    dimensions: DoorDimensions,
    cellWidth: number = 97.5,
    cellHeight: number = 60
): LayerGroupScale {
    // Get maximum dimension (consider width and height)
    const maxDim = Math.max(dimensions.width, dimensions.height);
    const cellMaxDim = Math.max(cellWidth, cellHeight);

    // Try each scale from largest to smallest
    for (const groupScale of LAYER_GROUP_SCALES) {
        const scaledSize = maxDim * groupScale.scale;

        // If door fits in cell with this scale, use it
        if (scaledSize <= cellMaxDim) {
            return groupScale;
        }
    }

    // Fallback to smallest scale (1/100)
    return LAYER_GROUP_SCALES[LAYER_GROUP_SCALES.length - 1];
}

/**
 * DXF Layer Configuration
 */
export interface DxfLayerConfig {
    frame: string;           // Frame outline (Group F, 1/1)
    joineryOutline: string;  // Door outline (Dynamic group)
    joineryFill: string;     // Door fill (Dynamic group)
    dimensions: string;      // Dimension lines (Group F, 1/1)
    text: string;            // Text labels (Group F, 1/1)
    humanScale: string;      // Human scale figure (Group F, 1/1)
}

/**
 * Default layer configuration
 * Note: joineryOutline and joineryFill will be dynamically determined per door
 */
export const DEFAULT_DXF_LAYER_CONFIG: DxfLayerConfig = {
    frame: 'F-1',           // Frame: 1/1 scale
    joineryOutline: '0-2',  // Default to group 0 (will be overridden)
    joineryFill: '0-E',     // Default to group 0 (will be overridden)
    dimensions: 'F-F',      // Dimensions: 1/1 scale
    text: 'F-0',            // Text: 1/1 scale
    humanScale: 'F-9'       // Human scale: 1/1 scale
};

/**
 * DXF Color Configuration (unchanged)
 */
export interface DxfColorConfig {
    frame?: number;
    stile?: number;
    rail?: number;
    middleRail?: number;
    tsuka?: number;
    kumiko?: number;
    glass?: number;
}

export const DEFAULT_DXF_COLOR_CONFIG: DxfColorConfig = {
    frame: 7,        // White
    stile: 150,      // Brown (wood)
    rail: 150,       // Brown (wood)
    middleRail: 150, // Brown (wood)
    tsuka: 150,      // Brown (wood)
    kumiko: 150,     // Brown (wood)
    glass: 210       // Light blue (glass)
};
