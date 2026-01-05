import { Door } from '../db/db';
import { DoorGeometryGenerator, GeometryResult, GeometryPart } from '../logic/GeometryGenerator';
import { DxfLayerConfig, DxfColorConfig, DEFAULT_DXF_LAYER_CONFIG, DEFAULT_DXF_COLOR_CONFIG } from '../domain/DxfConfig';
import { DxfExportOptions, DEFAULT_DXF_EXPORT_OPTIONS } from '../domain/DxfExportOptions';
import { debugDxf } from '../config/debug';

/**
 * Enhanced DXF Generator for JWCAD compatibility.
 * Generates ASCII DXF (R12 COMPATIBLE) with SOLID fill support.
 */
export class DxfGenerator {
    private lines: string[] = [];
    private layerConfig: DxfLayerConfig;
    private colorConfig: DxfColorConfig;

    constructor(layerConfig?: DxfLayerConfig, colorConfig?: DxfColorConfig) {
        this.layerConfig = layerConfig || DEFAULT_DXF_LAYER_CONFIG;
        this.colorConfig = colorConfig || DEFAULT_DXF_COLOR_CONFIG;
        this.header();
    }

    private add(code: number, value: string | number) {
        this.lines.push(code.toString());
        this.lines.push(value.toString());
    }

    private header() {
        this.add(0, 'SECTION');
        this.add(2, 'HEADER');
        this.add(9, '$ACADVER');
        this.add(1, 'AC1009'); // R12 format
        this.add(9, '$INSUNITS');
        this.add(70, 4); // Millimeters
        this.add(0, 'ENDSEC');

        // TABLES (Layers)
        this.add(0, 'SECTION');
        this.add(2, 'TABLES');
        this.add(0, 'TABLE');
        this.add(2, 'LAYER');

        // Define all layers used
        this.defineLayer(this.layerConfig.joineryOutline, 7);
        this.defineLayer(this.layerConfig.joineryFill, 7);
        this.defineLayer(this.layerConfig.dimensions, 4);
        this.defineLayer(this.layerConfig.text, 4);
        this.defineLayer(this.layerConfig.frame, 7);
        this.defineLayer('5_SCALE', 3); // Human scale layer (green)

        this.add(0, 'ENDTAB');
        this.add(0, 'ENDSEC');

        // ENTITIES Start
        this.add(0, 'SECTION');
        this.add(2, 'ENTITIES');
    }

    private defineLayer(name: string, color: number) {
        this.add(0, 'LAYER');
        this.add(2, name);
        this.add(70, 0);
        this.add(62, color);
        this.add(6, 'CONTINUOUS');
    }

    public addLine(x1: number, y1: number, x2: number, y2: number, layer: string, color?: number) {
        this.add(0, 'LINE');
        this.add(8, layer);
        if (color !== undefined) {
            this.add(62, color);
        }
        this.add(10, x1);
        this.add(20, y1);
        this.add(11, x2);
        this.add(21, y2);
    }

    /**
     * Add SOLID entity (filled quadrilateral)
     * DXF SOLID uses 4 corner points
     */
    public addSolid(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number, layer: string, color: number) {
        this.add(0, 'SOLID');
        this.add(8, layer);
        this.add(62, color);
        this.add(10, x1);
        this.add(20, y1);
        this.add(11, x2);
        this.add(21, y2);
        this.add(12, x3);
        this.add(22, y3);
        this.add(13, x4);
        this.add(23, y4);
    }

    /**
     * Add filled rectangle using SOLID entity
     */
    public addFilledRect(x: number, y: number, w: number, h: number, layer: string, color: number) {
        // SOLID entity: corners in specific order
        this.addSolid(
            x, y,           // Bottom-left
            x + w, y,       // Bottom-right
            x + w, y + h,   // Top-right
            x, y + h,       // Top-left
            layer,
            color
        );
    }

    public addText(x: number, y: number, text: string, height: number, layer: string) {
        this.add(0, 'TEXT');
        this.add(8, layer);
        this.add(10, x);
        this.add(20, y);
        this.add(40, height);
        this.add(1, text);
    }

    /**
     * Add CIRCLE entity
     */
    public addCircle(cx: number, cy: number, radius: number, layer: string, color?: number) {
        this.add(0, 'CIRCLE');
        this.add(8, layer);
        if (color !== undefined) {
            this.add(62, color);
        }
        this.add(10, cx);
        this.add(20, cy);
        this.add(40, radius);
    }

    public addRect(x: number, y: number, w: number, h: number, layer: string) {
        this.addLine(x, y, x + w, y, layer);
        this.addLine(x + w, y, x + w, y + h, layer);
        this.addLine(x + w, y + h, x, y + h, layer);
        this.addLine(x, y + h, x, y, layer);
    }

    public generate(): string {
        this.add(0, 'ENDSEC'); // End ENTITIES
        this.add(0, 'EOF');
        return this.lines.join('\n');
    }
}

/**
 * Map GeometryPart type to DXF color
 */
function getPartColor(partType: string, colorConfig: DxfColorConfig): number {
    switch (partType) {
        case 'stile':
            return colorConfig.stile;
        case 'top-rail':
        case 'bottom-rail':
        case 'middle-rail':
            return colorConfig.rail;
        case 'kumiko-vert':
        case 'kumiko-horiz':
            return colorConfig.kumiko;
        case 'tsuka':
            return colorConfig.tsuka;
        case 'glass':
            return colorConfig.glass;
        default:
            return colorConfig.panel;
    }
}

export const generateDoorDxf = (
    doors: Door[],
    layerConfig?: DxfLayerConfig,
    colorConfig?: DxfColorConfig,
    options?: DxfExportOptions
): string => {
    const dxf = new DxfGenerator(layerConfig, colorConfig);
    const effectiveColorConfig = colorConfig || DEFAULT_DXF_COLOR_CONFIG;
    const effectiveLayerConfig = layerConfig || DEFAULT_DXF_LAYER_CONFIG;
    const effectiveOptions = { ...DEFAULT_DXF_EXPORT_OPTIONS, ...options };

    // デバッグログ: DXF生成パラメータ
    debugDxf('generateDoorDxf called', {
        doorCount: doors.length,
        passedOptions: options,
        effectiveOptions: effectiveOptions,
        useA3Layout: effectiveOptions.useA3Layout,
        includeHumanScale: effectiveOptions.includeHumanScale
    });

    // A3 Layout constants (mm)
    const CELL_WIDTH = 130;
    const CELL_HEIGHT = 120;
    const CELL_SPACING_X = 140;
    const CELL_SPACING_Y = 148.5;
    const HEADER_HEIGHT = 15;
    const SPEC_HEIGHT = 25;
    const DRAWING_AREA_HEIGHT = CELL_HEIGHT - HEADER_HEIGHT - SPEC_HEIGHT; // 80mm

    doors.forEach((door, doorIndex) => {
        const { width, height } = door.dimensions;

        // Calculate inner dimensions
        const innerW = width - (door.dimensions.stileWidth * 2);
        const innerH = height - door.dimensions.topRailWidth - door.dimensions.bottomRailWidth;

        let offsetX: number, offsetY: number, scale: number;

        if (effectiveOptions.useA3Layout) {
            // **A3 Grid Layout (2×3)**
            const col = doorIndex % 3;
            const row = Math.floor(doorIndex / 3);

            // Cell position
            const cellX = col * CELL_SPACING_X;
            // Base Y position for the row (increasing downward in layout terms)
            const baseY = row * CELL_SPACING_Y;

            // Calculate scale to fit door in drawing area
            const maxDoorWidth = CELL_WIDTH * 0.75; // 97.5mm (25% margin)
            const maxDoorHeight = DRAWING_AREA_HEIGHT * 0.75; // 60mm (25% margin)

            const scaleX = maxDoorWidth / width;
            const scaleY = maxDoorHeight / height;
            scale = Math.min(scaleX, scaleY); // Use smaller scale to fit

            const scaledWidth = width * scale;
            const scaledHeight = height * scale;

            // Center door in cell
            offsetX = cellX + (CELL_WIDTH - scaledWidth) / 2;
            offsetY = baseY + HEADER_HEIGHT + (DRAWING_AREA_HEIGHT - scaledHeight) / 2;
        } else {
            // **Linear Layout (original)**
            offsetX = doorIndex * (width + 2000);
            offsetY = 0;
            scale = 1; // No scaling
        }

        // 1. Generate Geometry (Detailed parts)
        const geometry: GeometryResult = DoorGeometryGenerator.generate(door.dimensions);

        // 2. Draw SOLID fills for each part (Layer Group 0, Layer E)
        geometry.parts.forEach(part => {
            const color = getPartColor(part.type, effectiveColorConfig);
            const dxfY = height - part.y - part.h;
            dxf.addFilledRect(
                offsetX + part.x * scale,
                offsetY + dxfY * scale,
                part.w * scale,
                part.h * scale,
                effectiveLayerConfig.joineryFill,
                color
            );
        });

        // 3. Draw Outlines for each part (Layer Group 0, Layer 2)
        geometry.parts.forEach(part => {
            const dxfY = height - part.y - part.h;
            dxf.addRect(
                offsetX + part.x * scale,
                offsetY + dxfY * scale,
                part.w * scale,
                part.h * scale,
                effectiveLayerConfig.joineryOutline
            );
        });

        // 4. Overall Frame (Layer Group 8, Layer 1)
        dxf.addRect(offsetX, offsetY, width * scale, height * scale, effectiveLayerConfig.frame);

        // 5. Detailed Dimensions (Layer Group 8, Layer F)
        const scaledInnerW = innerW * scale;
        const scaledInnerH = innerH * scale;
        const scaledStileWidth = door.dimensions.stileWidth * scale;
        const scaledBottomRailWidth = door.dimensions.bottomRailWidth * scale;

        // Horizontal dimensions (bottom)
        const dimY1 = offsetY - 50 * scale; // Outer dimension
        const dimY2 = offsetY - 100 * scale; // Inner dimension

        // Outer width dimension
        dxf.addLine(offsetX, dimY1, offsetX + width * scale, dimY1, effectiveLayerConfig.dimensions);
        dxf.addLine(offsetX, dimY1 + 10, offsetX, dimY1 - 10, effectiveLayerConfig.dimensions);
        dxf.addLine(offsetX + width * scale, dimY1 + 10, offsetX + width * scale, dimY1 - 10, effectiveLayerConfig.dimensions);
        dxf.addText(offsetX + width * scale / 2 - 40, dimY1 + 15, `W ${width}`, 20 * scale, effectiveLayerConfig.dimensions);

        // Inner width dimension
        const innerStartX = offsetX + scaledStileWidth;
        dxf.addLine(innerStartX, dimY2, innerStartX + scaledInnerW, dimY2, effectiveLayerConfig.dimensions);
        dxf.addLine(innerStartX, dimY2 + 8, innerStartX, dimY2 - 8, effectiveLayerConfig.dimensions);
        dxf.addLine(innerStartX + scaledInnerW, dimY2 + 8, innerStartX + scaledInnerW, dimY2 - 8, effectiveLayerConfig.dimensions);
        dxf.addText(innerStartX + scaledInnerW / 2 - 30, dimY2 + 12, `${innerW}`, 18 * scale, effectiveLayerConfig.dimensions);

        // Vertical dimensions (left)
        const dimX1 = offsetX - 50 * scale; // Outer dimension
        const dimX2 = offsetX - 100 * scale; // Inner dimension

        // Outer height dimension
        dxf.addLine(dimX1, offsetY, dimX1, offsetY + height * scale, effectiveLayerConfig.dimensions);
        dxf.addLine(dimX1 - 10, offsetY, dimX1 + 10, offsetY, effectiveLayerConfig.dimensions);
        dxf.addLine(dimX1 - 10, offsetY + height * scale, dimX1 + 10, offsetY + height * scale, effectiveLayerConfig.dimensions);
        dxf.addText(dimX1 - 40, offsetY + height * scale / 2 + 10, `H ${height}`, 20 * scale, effectiveLayerConfig.dimensions);

        // Inner height dimension
        const innerStartY = offsetY + scaledBottomRailWidth;
        dxf.addLine(dimX2, innerStartY, dimX2, innerStartY + scaledInnerH, effectiveLayerConfig.dimensions);
        dxf.addLine(dimX2 - 8, innerStartY, dimX2 + 8, innerStartY, effectiveLayerConfig.dimensions);
        dxf.addLine(dimX2 - 8, innerStartY + scaledInnerH, dimX2 + 8, innerStartY + scaledInnerH, effectiveLayerConfig.dimensions);
        dxf.addText(dimX2 - 30, innerStartY + scaledInnerH / 2 + 8, `${innerH}`, 18 * scale, effectiveLayerConfig.dimensions);

        // 6. Human Scale Figure (Layer 5_SCALE) - Optional
        if (effectiveOptions.includeHumanScale && !effectiveOptions.useA3Layout) {
            // Only show human scale in linear layout (too crowded in A3)
            const humanX = offsetX + width * scale + 500;
            const humanHeight = 1600;
            const humanWidth = 400;

            const headRadius = 80;
            const headY = humanHeight - headRadius;
            dxf.addCircle(humanX, headY, headRadius, '5_SCALE', 3);

            const torsoTop = humanHeight - headRadius * 2 - 20;
            const torsoBottom = humanHeight * 0.55;
            dxf.addLine(humanX, torsoTop, humanX, torsoBottom, '5_SCALE', 3);

            dxf.addLine(humanX - humanWidth / 2, torsoTop + 50, humanX + humanWidth / 2, torsoTop + 50, '5_SCALE', 3);

            dxf.addLine(humanX - humanWidth / 2, torsoTop + 50, humanX - humanWidth / 2 - 50, torsoBottom + 100, '5_SCALE', 3);
            dxf.addLine(humanX + humanWidth / 2, torsoTop + 50, humanX + humanWidth / 2 + 50, torsoBottom + 100, '5_SCALE', 3);

            dxf.addLine(humanX, torsoBottom, humanX - 150, 0, '5_SCALE', 3);
            dxf.addLine(humanX, torsoBottom, humanX + 150, 0, '5_SCALE', 3);
        }

        if (effectiveOptions.useA3Layout) {
            // 7. Header / Tag (in cell) - A3 Layout
            const col = doorIndex % 3;
            const row = Math.floor(doorIndex / 3);
            const cellX = col * CELL_SPACING_X;
            const baseY = row * CELL_SPACING_Y;

            // Tag box
            dxf.addRect(cellX, baseY + CELL_HEIGHT, 60, 12, effectiveLayerConfig.text);
            dxf.addText(cellX + 5, baseY + CELL_HEIGHT + 3, door.tag, 8, effectiveLayerConfig.text);

            // Name
            dxf.addText(cellX + 65, baseY + CELL_HEIGHT + 3, door.name, 6, effectiveLayerConfig.text);

            // 8. Specs (bottom of cell)
            const specY = baseY - 15;
            dxf.addText(cellX, specY, `Spec:`, 5, effectiveLayerConfig.text);
        } else {
            // 7. Header / Tag (above door) - Linear Layout
            dxf.addRect(offsetX, offsetY + height * scale + 50, 300, 150, effectiveLayerConfig.text);
            dxf.addText(offsetX + 50, offsetY + height * scale + 100, door.tag, 80, effectiveLayerConfig.text);
            dxf.addText(offsetX + 350, offsetY + height * scale + 100, door.name, 60, effectiveLayerConfig.text);

            // 8. Specs (below door)
            const specY = offsetY - 200;
            dxf.addText(offsetX, specY, `Specifications:`, 40, effectiveLayerConfig.text);
        }
    });

    return dxf.generate();
};
