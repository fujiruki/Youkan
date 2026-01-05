import { Door } from '../db/db';

/**
 * Simple DXF Generator for JWCAD compatibility.
 * Generates ASCII DXF (R12 COMPATIBLE).
 */
export class DxfGenerator {
    private lines: string[] = [];

    constructor() {
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

        this.defineLayer('0_FRAME', 7); // White
        this.defineLayer('1_VISUAL', 7); // White
        this.defineLayer('3_DIMS', 4); // Cyan
        this.defineLayer('4_TEXT', 4); // Cyan
        this.defineLayer('6_COST', 6); // Magenta (Hidden usually)

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

    public addLine(x1: number, y1: number, x2: number, y2: number, layer: string = '0_FRAME') {
        this.add(0, 'LINE');
        this.add(8, layer);
        this.add(10, x1);
        this.add(20, y1);
        this.add(11, x2);
        this.add(21, y2);
    }

    public addText(x: number, y: number, text: string, height: number, layer: string = '4_TEXT') {
        this.add(0, 'TEXT');
        this.add(8, layer);
        this.add(10, x);
        this.add(20, y);
        this.add(40, height);
        this.add(1, text);
    }

    public addRect(x: number, y: number, w: number, h: number, layer: string = '0_FRAME') {
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

export const generateDoorDxf = (door: Door): string => {
    const dxf = new DxfGenerator();
    const { width, height, stileWidth, topRailWidth, bottomRailWidth } = door.dimensions;

    // 1. Frame (Outer) - Layer 0
    dxf.addRect(0, 0, width, height, '0_FRAME');

    // 2. Stiles & Rails (Inner visual) - Layer 1
    // Left Stile
    dxf.addRect(0, 0, stileWidth, height, '1_VISUAL');
    // Right Stile
    dxf.addRect(width - stileWidth, 0, stileWidth, height, '1_VISUAL');
    // Top Rail
    dxf.addRect(stileWidth, height - topRailWidth, width - (stileWidth * 2), topRailWidth, '1_VISUAL');
    // Bottom Rail
    dxf.addRect(stileWidth, 0, width - (stileWidth * 2), bottomRailWidth, '1_VISUAL');

    // 3. Dimensions - Layer 3
    // Width Dim
    const dimY = -150;
    dxf.addLine(0, dimY, width, dimY, '3_DIMS');
    dxf.addLine(0, dimY + 20, 0, dimY - 20, '3_DIMS'); // Tick
    dxf.addLine(width, dimY + 20, width, dimY - 20, '3_DIMS'); // Tick
    dxf.addText(width / 2 - 50, dimY + 30, `W ${width}`, 50, '3_DIMS');

    // Height Dim
    const dimX = -150;
    dxf.addLine(dimX, 0, dimX, height, '3_DIMS');
    dxf.addLine(dimX - 20, 0, dimX + 20, 0, '3_DIMS');
    dxf.addLine(dimX - 20, height, dimX + 20, height, '3_DIMS');
    dxf.addText(dimX - 100, height / 2, `H ${height}`, 50, '3_DIMS');

    // 4. Text Info - Layer 4
    dxf.addText(0, height + 200, `${door.tag} : ${door.name}`, 80, '4_TEXT');

    return dxf.generate();
};
