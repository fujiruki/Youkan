import React, { useMemo } from 'react';
import { QuantityMetric } from '../../logic/QuantityEngine';

interface VolumeCurveProps {
    allDays: Date[];
    metrics: Map<string, QuantityMetric>;
}

export const VolumeCurve: React.FC<VolumeCurveProps> = ({ allDays, metrics }) => {
    const points = useMemo(() => {
        if (allDays.length === 0) return '';

        // Grid specific layout: 7 columns
        // Actually, VolumeCurve is used as an absolute background.
        // It needs to map x to days and y to volume ratio.

        const width = 100; // SVG viewBox %
        const height = 100;

        return allDays.map((day, i) => {
            const metric = metrics.get(day.toDateString());
            const ratio = metric?.ratio || 0;
            // Map ratio 0->0, 1->60, 1.5+ -> 100
            const y = height - Math.min(ratio * 60, height);
            const x = (i / (allDays.length - 1)) * width;
            return `${x},${y}`;
        }).join(' ');
    }, [allDays, metrics]);

    if (!points) return null;

    return (
        <polyline
            points={points}
            fill="url(#volumeGradient)"
            fillOpacity="0.1"
            stroke="url(#volumeGradient)"
            strokeWidth="2"
            strokeLinejoin="round"
            style={{ vectorEffect: 'non-scaling-stroke' }}
        />
    );
};
