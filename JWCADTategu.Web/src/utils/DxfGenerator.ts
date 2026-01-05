import { Door } from '../db/db';
import { DoorGeometryGenerator, GeometryResult, GeometryPart } from '../logic/GeometryGenerator';
import { DxfLayerConfig, DxfColorConfig, DEFAULT_DXF_LAYER_CONFIG, DEFAULT_DXF_COLOR_CONFIG } from '../domain/DxfConfig';

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

export const generateDoorDxf = (doors: Door[], layerConfig?: DxfLayerConfig, colorConfig?: DxfColorConfig): string => {
    const dxf = new DxfGenerator(layerConfig, colorConfig);
    const effectiveColorConfig = colorConfig || DEFAULT_DXF_COLOR_CONFIG;
    const effectiveLayerConfig = layerConfig || DEFAULT_DXF_LAYER_CONFIG;

    let offsetX = 0;
    const GAP = 2000; // Gap between drawings

    doors.forEach(door => {
        const { width, height } = door.dimensions;

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

        // 5. Dimensions (Layer Group 8, Layer F)
        const dimY = -150;
        dxf.addLine(offsetX, dimY, offsetX + width, dimY, effectiveLayerConfig.dimensions);
        dxf.addLine(offsetX, dimY + 20, offsetX, dimY - 20, effectiveLayerConfig.dimensions);
        dxf.addLine(offsetX + width, dimY + 20, offsetX + width, dimY - 20, effectiveLayerConfig.dimensions);
        dxf.addText(offsetX + width / 2 - 100, dimY + 30, `W ${width}`, 50, effectiveLayerConfig.dimensions);

        const dimX = offsetX - 150;
        dxf.addLine(dimX, 0, dimX, height, effectiveLayerConfig.dimensions);
        dxf.addLine(dimX - 20, 0, dimX + 20, 0, effectiveLayerConfig.dimensions);
        dxf.addLine(dimX - 20, height, dimX + 20, height, effectiveLayerConfig.dimensions);
        dxf.addText(dimX - 100, height / 2, `H ${height}`, 50, effectiveLayerConfig.dimensions);

        // 6. Header / Tag (Layer Group 8, Layer 0)
        dxf.addRect(offsetX, height + 300, 300, 150, effectiveLayerConfig.text);
        dxf.addText(offsetX + 50, height + 350, door.tag, 80, effectiveLayerConfig.text);

        // Name
        dxf.addText(offsetX + 350, height + 350, door.name, 60, effectiveLayerConfig.text);

        // 7. Specs (Layer Group 8, Layer 0)
        const specY = -400;
        dxf.addText(offsetX, specY, `Specifications:`, 40, effectiveLayerConfig.text);

        // Advance Offset
        offsetX += width + GAP;
    });

    return dxf.generate();
};
