import { DoorDimensions } from '../domain/DoorDimensions';

export interface Point { x: number; y: number; }
export interface LineSegment { start: Point; end: Point; type: 'outline' | 'detail'; }

export type PartType = 'stile' | 'top-rail' | 'bottom-rail' | 'middle-rail' | 'tsuka' | 'kumiko-vert' | 'kumiko-horiz' | 'glass';

export interface GeometryPart {
    id: string; // Unique ID for interaction (e.g., 'stile-left', 'mr-0')
    type: PartType;
    x: number;
    y: number;
    w: number;
    h: number;
    meta?: any; // Extra data like index
}

export interface GeometryResult {
    lines: LineSegment[];
    parts: GeometryPart[];
}

export class DoorGeometryGenerator {
    static generate(dim: DoorDimensions): GeometryResult {
        const lines: LineSegment[] = [];
        const parts: GeometryPart[] = [];

        // Helper to add lines for a rect (Visuals)
        const addLines = (x: number, y: number, w: number, h: number) => {
            // Top
            lines.push({ start: { x, y }, end: { x: x + w, y }, type: 'detail' });
            // Bottom
            lines.push({ start: { x, y: y + h }, end: { x: x + w, y: y + h }, type: 'detail' });
            // Left
            lines.push({ start: { x, y }, end: { x, y: y + h }, type: 'detail' });
            // Right
            lines.push({ start: { x: x + w, y }, end: { x: x + w, y: y + h }, type: 'detail' });
        };

        // Helper to add a fully defined part (Interaction + Visuals)
        const addPart = (type: PartType, id: string, x: number, y: number, w: number, h: number, meta?: any) => {
            parts.push({ id, type, x, y, w, h, meta });
            addLines(x, y, w, h);
        };

        // 1. Stiles (Left/Right)
        addPart('stile', 'stile-left', 0, 0, dim.stileWidth, dim.height);
        addPart('stile', 'stile-right', dim.width - dim.stileWidth, 0, dim.stileWidth, dim.height);

        // 2. Rails (Top/Bottom) - Draw BETWEEN stiles
        const effectiveWidth = dim.width - (dim.stileWidth * 2);
        const startX = dim.stileWidth;

        addPart('top-rail', 'rail-top', startX, 0, effectiveWidth, dim.topRailWidth);
        addPart('bottom-rail', 'rail-bottom', startX, dim.height - dim.bottomRailWidth, effectiveWidth, dim.bottomRailWidth);

        // 3. Middle Rails (Naka-Zan) & Gap Calculation
        let firstMiddleRailTopY: number | null = null;
        let lastMiddleRailBottomY: number | null = null;

        if (dim.middleRailCount > 0 && dim.middleRailWidth > 0) {
            let startY = 0;
            let gap = 0;

            // Positioning Logic
            if (dim.middleRailPosition && dim.middleRailPosition > 0) {
                // Manual Positioning
                const topY = dim.height - dim.middleRailPosition;
                startY = topY;
                gap = dim.middleRailWidth;
            } else {
                // Auto Positioning
                const innerHeight = dim.height - dim.topRailWidth - dim.bottomRailWidth;
                const totalMiddleRailHeight = dim.middleRailCount * dim.middleRailWidth;
                const remainingSpace = innerHeight - totalMiddleRailHeight;
                gap = remainingSpace / (dim.middleRailCount + 1);
                startY = dim.topRailWidth + gap;
            }

            let currentY = startY;
            firstMiddleRailTopY = currentY;

            // SAFETY CAP for Middle Rails
            const safeMiddleRailCount = Math.min(dim.middleRailCount, 500);
            for (let i = 0; i < safeMiddleRailCount; i++) {
                addPart('middle-rail', `rail-middle-${i}`, startX, currentY, effectiveWidth, dim.middleRailWidth, { index: i });

                lastMiddleRailBottomY = currentY + dim.middleRailWidth;
                currentY += dim.middleRailWidth + gap;
            }
        }

        // 4. Tsuka (Verticals)
        const tsukaCount = dim.tsukaCount || 0;
        const tsukaWidth = dim.tsukaWidth || 30;

        if (tsukaCount > 0 && tsukaWidth > 0) {
            const innerWidth = dim.width - (dim.stileWidth * 2);
            const totalTsukaWidth = tsukaCount * tsukaWidth;
            const remainingWidth = innerWidth - totalTsukaWidth;
            const gap = remainingWidth / (tsukaCount + 1);

            let startY = dim.topRailWidth;
            let h = dim.height - dim.topRailWidth - dim.bottomRailWidth;

            if (lastMiddleRailBottomY !== null) {
                startY = lastMiddleRailBottomY;
                h = (dim.height - dim.bottomRailWidth) - lastMiddleRailBottomY;
            }

            // SAFETY CAP for Tsuka
            const safeTsukaCount = Math.min(tsukaCount, 500);
            let currentX = dim.stileWidth + gap;
            for (let i = 0; i < safeTsukaCount; i++) {
                addPart('tsuka', `tsuka-${i}`, currentX, startY, tsukaWidth, h, { index: i });
                currentX += tsukaWidth + gap;
            }
        }

        // 5. Kumiko (Fine Grid) - Vertical
        const kvCount = dim.kumikoVertCount || 0;
        const kvWidth = dim.kumikoVertWidth || 6;

        if (kvCount > 0 && kvWidth > 0) {
            const innerWidth = dim.width - (dim.stileWidth * 2);
            const totalWidth = kvCount * kvWidth;
            const remaining = innerWidth - totalWidth;
            const gap = remaining / (kvCount + 1);

            let startY = dim.topRailWidth;
            let h = dim.height - dim.topRailWidth - dim.bottomRailWidth;

            if (firstMiddleRailTopY !== null) {
                h = firstMiddleRailTopY - startY;
            }

            // SAFETY CAP for Kumiko Vert
            const safeKvCount = Math.min(kvCount, 500);
            let currentX = dim.stileWidth + gap;
            for (let i = 0; i < safeKvCount; i++) {
                addPart('kumiko-vert', `kumiko-v-${i}`, currentX, startY, kvWidth, h, { index: i });
                currentX += kvWidth + gap;
            }
        }

        // 6. Kumiko (Fine Grid) - Horizontal
        const khCount = dim.kumikoHorizCount || 0;
        const khWidth = dim.kumikoHorizWidth || 6;

        if (khCount > 0 && khWidth > 0) {
            let startYforGrid = dim.topRailWidth;
            let heightForGrid = dim.height - dim.topRailWidth - dim.bottomRailWidth;

            if (firstMiddleRailTopY !== null) {
                heightForGrid = firstMiddleRailTopY - startYforGrid;
            }

            const totalHeight = khCount * khWidth;
            const remaining = heightForGrid - totalHeight;
            const gap = remaining / (khCount + 1);

            const startX = dim.stileWidth;
            const w = dim.width - (dim.stileWidth * 2);

            // SAFETY CAP for Kumiko Horiz
            const safeKhCount = Math.min(khCount, 500);
            let currentY = startYforGrid + gap;
            for (let i = 0; i < safeKhCount; i++) {
                addPart('kumiko-horiz', `kumiko-h-${i}`, startX, currentY, w, khWidth, { index: i });
                currentY += khWidth + gap;
            }
        }

        // 7. Outer Frame Outline
        lines.push(
            { start: { x: 0, y: 0 }, end: { x: dim.width, y: 0 }, type: 'outline' },
            { start: { x: dim.width, y: 0 }, end: { x: dim.width, y: dim.height }, type: 'outline' },
            { start: { x: dim.width, y: dim.height }, end: { x: 0, y: dim.height }, type: 'outline' },
            { start: { x: 0, y: dim.height }, end: { x: 0, y: 0 }, type: 'outline' }
        );

        return { lines, parts };
    }
}
