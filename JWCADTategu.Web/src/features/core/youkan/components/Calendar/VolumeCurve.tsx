import React, { useMemo } from 'react';
import { QuantityMetric } from '../../logic/QuantityEngine';

interface VolumeCurveProps {
    allDays: Date[];
    metrics: Map<string, QuantityMetric>;
}

export const VolumeCurve: React.FC<VolumeCurveProps> = ({ allDays, metrics }) => {
    const pathData = useMemo(() => {
        if (allDays.length === 0) return '';

        const width = 1000; // Large coordinate space for precision
        const height = 200;
        const step = width / (allDays.length - 1);

        let d = `M 0,${height}`;

        const pts = allDays.map((day, i) => {
            const metric = metrics.get(day.toDateString());
            const ratio = metric?.ratio || 0;
            const y = height - Math.min(ratio * 100, height - 10);
            return { x: i * step, y };
        });

        // Use Quadratic Bezier for smoothing
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i];
            const p1 = pts[i + 1];
            const midX = (p0.x + p1.x) / 2;
            const midY = (p0.y + p1.y) / 2;
            if (i === 0) {
                d += ` L ${p0.x},${p0.y}`;
            }
            d += ` Q ${p0.x},${p0.y} ${midX},${midY}`;
        }

        const last = pts[pts.length - 1];
        d += ` L ${last.x},${last.y} L ${width},${height} Z`;
        return d;
    }, [allDays, metrics]);

    if (!pathData) return null;

    return (
        <path
            d={pathData}
            fill="url(#volumeGradient)"
            fillOpacity="0.15"
            stroke="url(#volumeGradient)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ vectorEffect: 'non-scaling-stroke' }}
            className="drop-shadow-sm"
        />
    );
};
