import { LineSegment } from "./GeometryGenerator";

export class JWCADExporter {
    static exportToText(lines: LineSegment[]): string {
        // Simple x1 y1 x2 y2 format
        // Could be enhanced with layers (e.g. 'lc1' for layer 1)

        let output = "";

        lines.forEach(line => {
            // JWCAD usually expects space separated coordinates
            // Rounding to avoid floating point weirdness
            const x1 = Math.round(line.start.x);
            const y1 = Math.round(line.start.y);
            const x2 = Math.round(line.end.x);
            const y2 = Math.round(line.end.y);

            output += `${x1} ${y1} ${x2} ${y2}\n`;
        });

        return output;
    }
}
