import { describe, it, expect } from 'vitest';
import { DoorGeometryGenerator } from '../GeometryGenerator';
import { DoorDimensions } from '../../domain/DoorDimensions';

const dim: DoorDimensions = {
    width: 900,  // DW
    height: 2000, // DH
    depth: 30,
    stileWidth: 120, // SW (Left/Right)
    topRailWidth: 100, // TRW
    bottomRailWidth: 200, // BRW
    middleRailWidth: 60,
    middleRailCount: 1,
    tsukaWidth: 30,
    tsukaCount: 0,
    kumikoVertWidth: 6,
    kumikoVertCount: 0,
    kumikoHorizWidth: 6,
    kumikoHorizCount: 0
};

describe('GeometryGenerator', () => {
    it('Stiles (縦框) Geometry', () => {
        const { rects } = DoorGeometryGenerator.generate(dim);

        // Spec: Left Stile (0,0) - (SW, DH)
        // Check finding a rect matching this
        const leftStile = rects.find(r => r.x === 0 && r.y === 0 && r.w === 120 && r.h === 2000);
        expect(leftStile).toBeDefined();

        // Spec: Right Stile (DW-SW, 0) - (DW, DH)
        // x = 900-120 = 780
        const rightStile = rects.find(r => r.x === 780 && r.y === 0 && r.w === 120 && r.h === 2000);
        expect(rightStile).toBeDefined();
    });

    it('Rails (上下桟) Geometry', () => {
        const { rects } = DoorGeometryGenerator.generate(dim);

        // Spec: Top Rail
        // X: SW (120) to DW-SW (780) -> width = 660
        // Y: Top align? 
        // Logic: Usually Y=0 for top edge of door? 
        // Wait, Web Canvas usually (0,0) is TOP-LEFT.
        // GeometryGenerator output is for Canvas (Y down) AND JWCAD (Y up?).
        // Current Code likely uses Canvas coords (Y=0 is Top). 
        // Let's assume Canvas coords for now as this is for Preview. 
        // If JWCAD Exporter flips it, that's fine.

        // Top Rail: Y=0? 
        // If Stile is full height (0 to 2000), Rail is between them.
        // If Y=0 is top, TopRail should receive y=0?
        // Let's check implementation behavior via test.

        const topRail = rects.find(r => r.x === 120 && r.y === 0 && r.w === 660 && r.h === 100);
        expect(topRail).toBeDefined();

        // Bottom Rail: Y = DH - BRW = 2000 - 200 = 1800
        const btmRail = rects.find(r => r.x === 120 && r.y === 1800 && r.w === 660 && r.h === 200);
        expect(btmRail).toBeDefined();
    });

    it('Middle Rail (中桟) Geometry', () => {
        const { rects } = DoorGeometryGenerator.generate(dim);
        // Middle Rail: 1 count. 
        // Usually centered?
        // Area between Top/Btm Rails:
        // Top Edge: 100, Btm Edge: 1800. Height = 1700.
        // Center of area = 100 + 1700/2 = 950.
        // Middle rail is 60 wide (height).
        // Center Y = 950. y = 950 - 30 = 920.
        // Let's see if logic does exact center.

        const midRail = rects.find(r => r.w === 660 && r.h === 60);
        expect(midRail).toBeDefined();
        if (midRail) {
            expect(midRail.x).toBe(120);
            // Check if it's roughly centered or at a sensible position
            expect(midRail.y).toBeGreaterThan(100);
            expect(midRail.y).toBeLessThan(1800);
        }
    });

    it('Wireframe Lines Generation', () => {
        const { lines } = DoorGeometryGenerator.generate(dim);
        // Just smoke test for lines
        expect(lines.length).toBeGreaterThan(10);

        // Check outline of Left Stile exists as line segments
        // (0,0)->(120,0) ?
        const topEdge = lines.find(l =>
            l.start.x === 0 && l.start.y === 0 && l.end.x === 120 && l.end.y === 0
        );
        expect(topEdge).toBeDefined();
    });
});
