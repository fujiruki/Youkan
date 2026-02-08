import React, { useEffect, useState } from 'react';
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
        const startPointId = `conn-point-${selectedDate}`;
        const startPointElement = document.getElementById(startPointId);
        if (!startPointElement) return;

        const container = startPointElement.closest('.relative');
        if (!container) return;
        const containerRect = container.getBoundingClientRect();

        const startRect = startPointElement.getBoundingClientRect();
        const startX = startRect.left - containerRect.left;
        const startY = startRect.top - containerRect.top;

        const newConnections: Connection[] = [];
        const processedTaskIds = new Set<string>();

        const allAssociatedTasks = [
            ...volume.tasksContributingToThisDay,
            ...volume.tasksEndingOnThisDay
        ];

        allAssociatedTasks.forEach(task => {
            if (processedTaskIds.has(task.id)) return;
            processedTaskIds.add(task.id);

            // [MODIFIED] Search for deadline card first, then fallback to cell point
            const cardId = `dead-line-card-${task.id}`;
            const cellId = `conn-point-${task.dueDate}`;

            if (task.dueDate === selectedDate) return;

            const endPointElement = document.getElementById(cardId) || document.getElementById(cellId);

            if (endPointElement) {
                const endRect = endPointElement.getBoundingClientRect();
                // [MODIFIED] Center of the target element
                const endX = (endRect.left + endRect.width / 2) - containerRect.left;
                const endY = (endRect.top + endRect.height / 2) - containerRect.top;

                // Create a quadratic bezier curve path
                const cpX = (startX + endX) / 2;
                const cpY = Math.min(startY, endY) - 60; // Curve upwards

                const path = `M ${startX} ${startY} Q ${cpX} ${cpY} ${endX} ${endY}`;
                newConnections.push({ id: `${selectedDate}-${task.id}`, path });
            }
        });

        setConnections(newConnections);

        const timer = setTimeout(() => {
            setConnections([]);
        }, 2000);

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
                            stroke="currentColor"
                            className="text-blue-500/40 dark:text-blue-400/30"
                            strokeWidth="2.5"
                            strokeDasharray="4 4"
                            fill="none"
                            initial={{ pathLength: 0, opacity: 0 }}
                            animate={{ pathLength: 1, opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                        />
                    ))}
                </AnimatePresence>
            </svg>
        </div>
    );
};
