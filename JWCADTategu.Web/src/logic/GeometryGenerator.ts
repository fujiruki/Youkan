import { DoorDimensions } from '../domain/DoorDimensions';

export interface Point { x: number; y: number; }
export interface LineSegment { start: Point; end: Point; type: 'outline' | 'detail'; }
export interface Rect { x: number; y: number; w: number; h: number; type: 'frame' | 'panel'; }

export interface GeometryResult {
    lines: LineSegment[];
    rects: Rect[];
}

export class DoorGeometryGenerator {
    static generate(dim: DoorDimensions): GeometryResult {
        const lines: LineSegment[] = [];
        const rects: Rect[] = [];

        // Helper to add rect and its outline lines
        const addPart = (x: number, y: number, w: number, h: number) => {
            rects.push({ x, y, w, h, type: 'frame' });
            // Top
            lines.push({ start: { x, y }, end: { x: x + w, y }, type: 'detail' });
            // Bottom
            lines.push({ start: { x, y: y + h }, end: { x: x + w, y: y + h }, type: 'detail' });
            // Left
            lines.push({ start: { x, y }, end: { x, y: y + h }, type: 'detail' });
            // Right
            lines.push({ start: { x: x + w, y }, end: { x: x + w, y: y + h }, type: 'detail' });
        };

        // 1. Stiles (Left/Right)
        addPart(0, 0, dim.stileWidth, dim.height); // Left
        addPart(dim.width - dim.stileWidth, 0, dim.stileWidth, dim.height); // Right

        // 2. Rails (Top/Bottom) - Draw BETWEEN stiles
        const effectiveWidth = dim.width - (dim.stileWidth * 2);
        const startX = dim.stileWidth;

        addPart(startX, 0, effectiveWidth, dim.topRailWidth); // Top Rail
        addPart(startX, dim.height - dim.bottomRailWidth, effectiveWidth, dim.bottomRailWidth); // Bottom Rail

        // 3. Middle Rails (Naka-Zan) & Gap Calculation
        let firstMiddleRailTopY: number | null = null;
        let lastMiddleRailBottomY: number | null = null;

        if (dim.middleRailCount > 0 && dim.middleRailWidth > 0) {
            let startY = 0;
            let gap = 0;

            // Positioning Logic
            if (dim.middleRailPosition && dim.middleRailPosition > 0) {
                // Manual Positioning: Top-most Rail Top matches Position
                // "Height" from Bottom => Top Y = H - Height
                const topY = dim.height - dim.middleRailPosition;
                startY = topY;

                // Gap is fixed to Width (or could be 0, but let's use Width for grouping)
                gap = dim.middleRailWidth;
            } else {
                // Auto Positioning (Evenly Spaced)
                const innerHeight = dim.height - dim.topRailWidth - dim.bottomRailWidth;
                const totalMiddleRailHeight = dim.middleRailCount * dim.middleRailWidth;
                const remainingSpace = innerHeight - totalMiddleRailHeight;
                gap = remainingSpace / (dim.middleRailCount + 1);
                startY = dim.topRailWidth + gap;
            }

            let currentY = startY;

            // Record first MR top position
            firstMiddleRailTopY = currentY;

            for (let i = 0; i < dim.middleRailCount; i++) {
                addPart(startX, currentY, effectiveWidth, dim.middleRailWidth);

                // Update last bottom
                lastMiddleRailBottomY = currentY + dim.middleRailWidth;

                currentY += dim.middleRailWidth + gap;
            }
        }

        // 4. Tsuka (Verticals)
        const tsukaCount = dim.tsukaCount || 0;
        const tsukaWidth = dim.tsukaWidth || 30; // Default 30mm

        if (tsukaCount > 0 && tsukaWidth > 0) {
            const innerWidth = dim.width - (dim.stileWidth * 2);
            const totalTsukaWidth = tsukaCount * tsukaWidth;
            const remainingWidth = innerWidth - totalTsukaWidth;
            const gap = remainingWidth / (tsukaCount + 1);

            // Determine Y Range
            let startY = dim.topRailWidth;
            let h = dim.height - dim.topRailWidth - dim.bottomRailWidth;

            // If Middle Rails exist, Tsuka is only from Bottom MR to Bottom Rail
            if (lastMiddleRailBottomY !== null) {
                startY = lastMiddleRailBottomY;
                h = (dim.height - dim.bottomRailWidth) - lastMiddleRailBottomY;
            }

            let currentX = dim.stileWidth + gap;
            for (let i = 0; i < tsukaCount; i++) {
                addPart(currentX, startY, tsukaWidth, h);
                currentX += tsukaWidth + gap;
            }
        }

        // 5. Kumiko (Fine Grid) - Vertical
        const kvCount = dim.kumikoVertCount || 0;
        const kvWidth = dim.kumikoVertWidth || 6; // Default 6mm

        if (kvCount > 0 && kvWidth > 0) {
            const innerWidth = dim.width - (dim.stileWidth * 2);
            const totalWidth = kvCount * kvWidth;
            const remaining = innerWidth - totalWidth;
            const gap = remaining / (kvCount + 1);

            // Determine Y Range
            let startY = dim.topRailWidth;
            let h = dim.height - dim.topRailWidth - dim.bottomRailWidth;

            // If Middle Rails exist, Kumiko Vert is only from Top Rail to Top MR
            if (firstMiddleRailTopY !== null) {
                // startY remains Top Rail Bottom (dim.topRailWidth)
                h = firstMiddleRailTopY - startY;
            }

            let currentX = dim.stileWidth + gap;
            for (let i = 0; i < kvCount; i++) {
                addPart(currentX, startY, kvWidth, h);
                currentX += kvWidth + gap;
            }
        }

        // 6. Kumiko (Fine Grid) - Horizontal
        const khCount = dim.kumikoHorizCount || 0;
        const khWidth = dim.kumikoHorizWidth || 6; // Default 6mm

        if (khCount > 0 && khWidth > 0) {
            // Updated Logic: If Middle Rails exist, distribute ONLY in Top Space
            let startYforGrid = dim.topRailWidth;
            let heightForGrid = dim.height - dim.topRailWidth - dim.bottomRailWidth;

            if (firstMiddleRailTopY !== null) {
                // Limit to Top Space
                heightForGrid = firstMiddleRailTopY - startYforGrid;
            }

            const totalHeight = khCount * khWidth;
            const remaining = heightForGrid - totalHeight;
            const gap = remaining / (khCount + 1);

            const startX = dim.stileWidth;
            const w = dim.width - (dim.stileWidth * 2);

            let currentY = startYforGrid + gap;
            for (let i = 0; i < khCount; i++) {
                addPart(startX, currentY, w, khWidth);
                currentY += khWidth + gap;
            }
        }

        // 5. Outer Frame Outline (for emphasis in CAD) - optional, but good for JWCAD
        lines.push(
            { start: { x: 0, y: 0 }, end: { x: dim.width, y: 0 }, type: 'outline' },
            { start: { x: dim.width, y: 0 }, end: { x: dim.width, y: dim.height }, type: 'outline' },
            { start: { x: dim.width, y: dim.height }, end: { x: 0, y: dim.height }, type: 'outline' },
            { start: { x: 0, y: dim.height }, end: { x: 0, y: 0 }, type: 'outline' }
        );

        return { lines, rects };
    }
}
