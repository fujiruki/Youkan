import { Door } from '../db/db';
import { DoorGeometryGenerator, GeometryResult } from '../logic/GeometryGenerator';

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
        this.defineLayer('2_CENTER', 4); // Cyan (Center lines)
        this.defineLayer('3_DIMS', 4); // Cyan
        this.defineLayer('4_TEXT', 4); // Cyan
        this.defineLayer('5_SCALE', 3); // Green (Human scale)
        this.defineLayer('6_COST', 6); // Magenta

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

export const generateDoorDxf = (doors: Door[]): string => {
    const dxf = new DxfGenerator();
    let offsetX = 0;
    const GAP = 2000; // Gap between drawings

    doors.forEach(door => {
        const { width, height } = door.dimensions;

        // 1. Generate Geometry (Detailed lines)
        const geometry: GeometryResult = DoorGeometryGenerator.generate(door.dimensions);

        // 2. Draw Geometry Lines (Layer 1_VISUAL usually, Frame on Layer 0)
        geometry.lines.forEach(line => {
            // Map types to layers
            const layer = line.type === 'outline' ? '0_FRAME' : '1_VISUAL';
            // Flip Y for CAD (CAD is Y-up, our logic might be Y-down or we just treat canvas coords)
            // Canvas is Y-down (0 at top). CAD is usually Y-up.
            // Standard JWW export often keeps coords. Let's do Y-up by flipping.

            dxf.addLine(
                offsetX + line.start.x, -line.start.y + height, // Flip Y for display
                offsetX + line.end.x, -line.end.y + height,
                layer
            );
        });

        // 3. Frame Rect (Outer) - to ensure clean outline
        dxf.addRect(offsetX, 0, width, height, '0_FRAME');

        // 4. Dimensions
        const dimY = -150;
        dxf.addLine(offsetX, dimY, offsetX + width, dimY, '3_DIMS');
        dxf.addLine(offsetX, dimY + 20, offsetX, dimY - 20, '3_DIMS');
        dxf.addLine(offsetX + width, dimY + 20, offsetX + width, dimY - 20, '3_DIMS');
        dxf.addText(offsetX + width / 2 - 100, dimY + 30, `W ${width}`, 50, '3_DIMS');

        const dimX = offsetX - 150;
        dxf.addLine(dimX, 0, dimX, height, '3_DIMS');
        dxf.addLine(dimX - 20, 0, dimX + 20, 0, '3_DIMS');
        dxf.addLine(dimX - 20, height, dimX + 20, height, '3_DIMS');
        dxf.addText(dimX - 100, height / 2, `H ${height}`, 50, '3_DIMS');

        // 5. Header / Tag
        // Tag Badge
        dxf.addRect(offsetX, height + 300, 300, 150, '4_TEXT'); // Box
        dxf.addText(offsetX + 50, height + 350, door.tag, 80, '4_TEXT');

        // Name
        dxf.addText(offsetX + 350, height + 350, door.name, 60, '4_TEXT');

        // 6. Specs (Simple list below)
        const specY = -400;
        dxf.addText(offsetX, specY, `Specifications:`, 40, '4_TEXT');
        // Add more spec details if needed later

        // Advance Offset
        offsetX += width + GAP;
    });

    return dxf.generate();
};
