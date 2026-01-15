import React, { useMemo, useState } from 'react';
import { DoorDimensions } from '../domain/DoorDimensions';
import { DoorGeometryGenerator, GeometryPart } from '../../../../logic/GeometryGenerator';

interface InteractionOverlayProps {
    dimensions: DoorDimensions;
    width: number;
    height: number;
    transform: { x: number, y: number, k: number };
    onPartClick: (part: GeometryPart, e: React.MouseEvent) => void;
}

export const InteractionOverlay: React.FC<InteractionOverlayProps> = ({ dimensions, width, height, transform, onPartClick }) => {
    const [hoveredPartId, setHoveredPartId] = useState<string | null>(null);

    const parts = useMemo(() => {
        if (width === 0 || height === 0) return [];
        // Just generate geometry, scaling is handled by transform
        const { parts } = DoorGeometryGenerator.generate(dimensions);
        return parts;
    }, [dimensions, width, height]);

    return (
        <div
            className="absolute inset-0 pointer-events-none"
            style={{ width, height }}
        >
            {parts.map(part => {
                // Use the passed transform!
                const x = part.x * transform.k + transform.x;
                const y = part.y * transform.k + transform.y;
                const w = part.w * transform.k;
                const h = part.h * transform.k;

                const isHovered = part.id === hoveredPartId;

                return (
                    <div
                        key={part.id}
                        className={`absolute cursor-pointer pointer-events-auto transition-all duration-200 border-2 ${isHovered ? 'border-emerald-400 bg-emerald-400/10 shadow-[0_0_15px_rgba(52,211,153,0.5)]' : 'border-transparent hover:border-emerald-400/50'}`}
                        style={{
                            left: x,
                            top: y,
                            width: w,
                            height: h,
                        }}
                        onMouseEnter={() => setHoveredPartId(part.id)}
                        onMouseLeave={() => setHoveredPartId(null)}
                        onClick={(e) => {
                            e.stopPropagation();
                            onPartClick(part, e);
                        }}
                        title={`${part.type} (${part.id})`}
                    />
                );
            })}
        </div>
    );
};
