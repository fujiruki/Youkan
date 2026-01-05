import { Door } from '../db/db';
import { DoorGeometryGenerator, GeometryResult, GeometryPart } from '../logic/GeometryGenerator';
import { DxfLayerConfig, DxfColorConfig, DEFAULT_DXF_LAYER_CONFIG, DEFAULT_DXF_COLOR_CONFIG } from '../domain/DxfConfig';
import { DxfExportOptions, DEFAULT_DXF_EXPORT_OPTIONS } from '../domain/DxfExportOptions';

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

    let offsetX = 0;
    const GAP = 2000; // Gap between drawings

    doors.forEach(door => {
        const { width, height } = door.dimensions;

        // Calculate inner dimensions
        const innerW = width - (door.dimensions.stileWidth * 2);
        const innerH = height - door.dimensions.topRailWidth - door.dimensions.bottomRailWidth;

        // 1. Generate Geometry (Detailed parts)
        const geometry: GeometryResult = DoorGeometryGenerator.generate(door.dimensions);

        // 2. Draw SOLID fills for each part (Layer Group 0, Layer E)
        geometry.parts.forEach(part => {
            const color = getPartColor(part.type, effectiveColorConfig);
            // Convert canvas coords to DXF coords (Y-flip)
            const dxfY = height - part.y - part.h;
            dxf.addFilledRect(
                offsetX + part.x,
                dxfY,
                part.w,
                part.h,
                effectiveLayerConfig.joineryFill,
                color
            );
        });

        // 3. Draw Outlines for each part (Layer Group 0, Layer 2)
        geometry.parts.forEach(part => {
            const dxfY = height - part.y - part.h;
            dxf.addRect(
                offsetX + part.x,
                dxfY,
                part.w,
                part.h,
                effectiveLayerConfig.joineryOutline
            );
        });

        // 4. Overall Frame (Layer Group 8, Layer 1)
        dxf.addRect(offsetX, 0, width, height, effectiveLayerConfig.frame);

        // 5. Detailed Dimensions (Layer Group 8, Layer F)

        // Horizontal dimensions (bottom)
        const dimY1 = -200; // Outer dimension
        const dimY2 = -350; // Inner dimension

        // Outer width dimension
        dxf.addLine(offsetX, dimY1, offsetX + width, dimY1, effectiveLayerConfig.dimensions);
        dxf.addLine(offsetX, dimY1 + 20, offsetX, dimY1 - 20, effectiveLayerConfig.dimensions);
        dxf.addLine(offsetX + width, dimY1 + 20, offsetX + width, dimY1 - 20, effectiveLayerConfig.dimensions);
        dxf.addText(offsetX + width / 2 - 80, dimY1 + 30, `W ${width}`, 40, effectiveLayerConfig.dimensions);

        // Inner width dimension
        const innerStartX = offsetX + door.dimensions.stileWidth;
        dxf.addLine(innerStartX, dimY2, innerStartX + innerW, dimY2, effectiveLayerConfig.dimensions);
        dxf.addLine(innerStartX, dimY2 + 15, innerStartX, dimY2 - 15, effectiveLayerConfig.dimensions);
        dxf.addLine(innerStartX + innerW, dimY2 + 15, innerStartX + innerW, dimY2 - 15, effectiveLayerConfig.dimensions);
        dxf.addText(innerStartX + innerW / 2 - 60, dimY2 + 25, `${innerW}`, 35, effectiveLayerConfig.dimensions);

        // Vertical dimensions (left)
        const dimX1 = offsetX - 200; // Outer dimension
        const dimX2 = offsetX - 350; // Inner dimension

        // Outer height dimension
        dxf.addLine(dimX1, 0, dimX1, height, effectiveLayerConfig.dimensions);
        dxf.addLine(dimX1 - 20, 0, dimX1 + 20, 0, effectiveLayerConfig.dimensions);
        dxf.addLine(dimX1 - 20, height, dimX1 + 20, height, effectiveLayerConfig.dimensions);
        dxf.addText(dimX1 - 80, height / 2 + 20, `H ${height}`, 40, effectiveLayerConfig.dimensions);

        // Inner height dimension
        const innerStartY = door.dimensions.bottomRailWidth;
        dxf.addLine(dimX2, innerStartY, dimX2, innerStartY + innerH, effectiveLayerConfig.dimensions);
        dxf.addLine(dimX2 - 15, innerStartY, dimX2 + 15, innerStartY, effectiveLayerConfig.dimensions);
        dxf.addLine(dimX2 - 15, innerStartY + innerH, dimX2 + 15, innerStartY + innerH, effectiveLayerConfig.dimensions);
        dxf.addText(dimX2 - 60, innerStartY + innerH / 2 + 15, `${innerH}`, 35, effectiveLayerConfig.dimensions);

        // 6. Human Scale Figure (Layer 5_SCALE) - Optional
        if (effectiveOptions.includeHumanScale) {
            const humanX = offsetX + width + 500; // 500mm to the right of door
            const humanHeight = 1600; // 160cm standard human height
            const humanWidth = 400; // Approximate shoulder width

            // Head (circle)
            const headRadius = 80;
            const headY = humanHeight - headRadius;
            dxf.addCircle(humanX, headY, headRadius, '5_SCALE', 3);

            // Body (torso)
            const torsoTop = humanHeight - headRadius * 2 - 20;
            const torsoBottom = humanHeight * 0.55;
            dxf.addLine(humanX, torsoTop, humanX, torsoBottom, '5_SCALE', 3);

            // Shoulders
            dxf.addLine(humanX - humanWidth / 2, torsoTop + 50, humanX + humanWidth / 2, torsoTop + 50, '5_SCALE', 3);

            // Arms
            dxf.addLine(humanX - humanWidth / 2, torsoTop + 50, humanX - humanWidth / 2 - 50, torsoBottom + 100, '5_SCALE', 3);
            dxf.addLine(humanX + humanWidth / 2, torsoTop + 50, humanX + humanWidth / 2 + 50, torsoBottom + 100, '5_SCALE', 3);

            // Legs
            dxf.addLine(humanX, torsoBottom, humanX - 150, 0, '5_SCALE', 3);
            dxf.addLine(humanX, torsoBottom, humanX + 150, 0, '5_SCALE', 3);
        }

        // 7. Header / Tag (Layer Group 8, Layer 0)
        dxf.addRect(offsetX, height + 300, 300, 150, effectiveLayerConfig.text);
        dxf.addText(offsetX + 50, height + 350, door.tag, 80, effectiveLayerConfig.text);

        // Name
        dxf.addText(offsetX + 350, height + 350, door.name, 60, effectiveLayerConfig.text);

        // 8. Specs (Layer Group 8, Layer 0)
        const specY = -500;
        dxf.addText(offsetX, specY, `Specifications:`, 40, effectiveLayerConfig.text);

        // Advance Offset
        offsetX += width + GAP;
    });

    return dxf.generate();
};
