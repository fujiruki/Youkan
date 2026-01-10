import { DoorDimensions } from '../domain/DoorDimensions';
import { DoorTextureSpecs, defaultTextureSpecs, MaterialTexture } from '../domain/DoorSpecs';

export interface Point { x: number; y: number; }
export interface LineSegment { start: Point; end: Point; type: 'outline' | 'detail'; }

export type PartType = 'stile' | 'top-rail' | 'bottom-rail' | 'middle-rail' | 'tsuka' | 'kumiko-vert' | 'kumiko-horiz' | 'glass' | 'panel';

export interface GeometryPart {
    id: string; // Unique ID for interaction (e.g., 'stile-left', 'mr-0')
    type: PartType;
    x: number;
    y: number;
    w: number;
    h: number;
    meta?: any; // Extra data like index
    texture?: MaterialTexture; // [NEW] Texture metadata
}

export interface GeometryResult {
    lines: LineSegment[];
    parts: GeometryPart[];
}

export class DoorGeometryGenerator {
    static generate(dim: DoorDimensions, textureSpecs: DoorTextureSpecs = defaultTextureSpecs): GeometryResult {
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

        // Helper to get texture based on part type
        const getTexture = (type: PartType): MaterialTexture | undefined => {
            switch (type) {
                case 'stile': return textureSpecs.stile;
                case 'top-rail': return textureSpecs.topRail;
                case 'bottom-rail': return textureSpecs.bottomRail;
                case 'middle-rail': return textureSpecs.middleRail;
                case 'tsuka': return textureSpecs.tsuka;
                case 'kumiko-vert':
                case 'kumiko-horiz': return textureSpecs.kumiko;
                case 'glass': return textureSpecs.glass;
                case 'panel': return textureSpecs.panel;
                default: return undefined;
            }
        };

        // Helper to add a fully defined part (Interaction + Visuals)
        const addPart = (type: PartType, id: string, x: number, y: number, w: number, h: number, meta?: any) => {
            const part: GeometryPart = {
                id, type, x, y, w, h, meta,
                texture: getTexture(type)
            };
            parts.push(part);
            addLines(x, y, w, h);
        };

        // 0. Base Panel (Glass/Wood) - Draw FIRST (Background)
        // Currently assumes a single panel filling the void between stile/rails.
        // Future improvement: Split panels based on middle rails for mixed materials.
        const panelX = dim.stileWidth;
        const panelY = dim.topRailWidth;
        const panelW = dim.width - (dim.stileWidth * 2);
        const panelH = dim.height - dim.topRailWidth - dim.bottomRailWidth;

        // For visual enhancement, we default to 'glass' for now unless specified otherwise in future logic.
        // If middle rails exist, it currently draws glass behind them, which is acceptable for v1.
        if (panelW > 0 && panelH > 0) {
            addPart('glass', 'main-glass', panelX, panelY, panelW, panelH);
        }

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
