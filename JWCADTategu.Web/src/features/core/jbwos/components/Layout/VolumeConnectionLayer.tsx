import React, { useMemo, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { DailyVolume } from '../../services/VolumeService';
import { motion, AnimatePresence } from 'framer-motion';

interface VolumeConnectionLayerProps {
    selectedDate: string | null;
    dailyVolumes: Record<string, DailyVolume>;
}

interface Connection {
    id: string;
    path: string;
}

export const VolumeConnectionLayer: React.FC<VolumeConnectionLayerProps> = ({ selectedDate, dailyVolumes }) => {
    const [connections, setConnections] = useState<Connection[]>([]);

    useEffect(() => {
        if (!selectedDate || !dailyVolumes[selectedDate]) {
            setConnections([]);
            return;
        }

        const volume = dailyVolumes[selectedDate];
        const startPointElement = document.getElementById(`conn-point-${selectedDate}`);
        if (!startPointElement) return;

        const containerRect = startPointElement.closest('.relative')?.getBoundingClientRect();
        if (!containerRect) return;

        const startRect = startPointElement.getBoundingClientRect();
        const startX = startRect.left - containerRect.left;
        const startY = startRect.top - containerRect.top;

        const newConnections: Connection[] = [];

        // Find all days where tasks contributing to this day have their deadlines
        // (Simplified: just find where the task cards are displayed)
        volume.tasks.forEach(task => {
            const dueDateStr = format(new Date(task.dueDate), 'yyyy-MM-dd');
            const endPointElement = document.getElementById(`conn-point-${dueDateStr}`);

            if (endPointElement) {
                const endRect = endPointElement.getBoundingClientRect();
                const endX = endRect.left - containerRect.left;
                const endY = endRect.top - containerRect.top;

                // Create a quadratic bezier curve path
                const cpX = (startX + endX) / 2;
                const cpY = Math.min(startY, endY) - 50; // Curve upwards

                const path = `M ${startX} ${startY} Q ${cpX} ${cpY} ${endX} ${endY}`;
                newConnections.push({ id: `${selectedDate}-${task.id}`, path });
            }
        });

        setConnections(newConnections);

        // Auto-clear after some time as per requirement ("0.5s animation only")
        const timer = setTimeout(() => {
            setConnections([]);
        }, 1500); // 0.5s animation + 1s visible

        return () => clearTimeout(timer);
    }, [selectedDate, dailyVolumes]);

    return (
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
            <svg className="w-full h-full">
                <AnimatePresence>
                    {connections.map(conn => (
                        <motion.path
                            key={conn.id}
                            d={conn.path}
                            stroke="rgba(59, 130, 246, 0.5)"
                            strokeWidth="2"
                            fill="none"
                            initial={{ pathLength: 0, opacity: 0 }}
                            animate={{ pathLength: 1, opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5, ease: "easeInOut" }}
                        />
                    ))}
                </AnimatePresence>
            </svg>
        </div>
    );
};
