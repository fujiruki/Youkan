import { differenceInDays, addDays, format, parseISO, isWithinInterval, startOfDay } from 'date-fns';

export interface TaskVolume {
    id: string;
    title: string;
    projectId: string;
    projectTitle: string;
    estimatedTime: number; // hours
    startDate: string; // YYYY-MM-DD
    dueDate: string; // YYYY-MM-DD
}

export interface VolumeSettings {
    workCapacity: number; // default 8
    lifeCapacity: number; // default 2
    managementMode: 'Separation' | 'Integration' | 'Dual';
}

export interface DailyVolume {
    date: string;
    workVolume: number;
    lifeVolume: number;
    totalVolume: number;
    workCapacity: number;
    lifeCapacity: number;
    totalCapacity: number;
    loadRatio: number; // percentage
    tasks: TaskVolume[];
}

export class VolumeService {
    /**
     * Calculates daily volumes for a given date range based on tasks and settings.
     */
    static calculateDailyVolumes(
        tasks: TaskVolume[],
        settings: VolumeSettings,
        startDateStr: string,
        endDateStr: string
    ): Record<string, DailyVolume> {
        const volumes: Record<string, DailyVolume> = {};
        const start = parseISO(startDateStr);
        const end = parseISO(endDateStr);

        // Initialize daily volume objects for the range
        let current = start;
        while (current <= end) {
            const dateKey = format(current, 'yyyy-MM-dd');
            volumes[dateKey] = {
                date: dateKey,
                workVolume: 0,
                lifeVolume: 0,
                totalVolume: 0,
                workCapacity: settings.workCapacity,
                lifeCapacity: settings.lifeCapacity,
                totalCapacity: settings.workCapacity + settings.lifeCapacity,
                loadRatio: 0,
                tasks: []
            };
            current = addDays(current, 1);
        }

        // Distribute task volumes
        tasks.forEach(task => {
            const taskStart = startOfDay(parseISO(task.startDate));
            const taskEnd = startOfDay(parseISO(task.dueDate));

            // Calculate overlap with the requested range
            const dayCount = Math.max(1, differenceInDays(taskEnd, taskStart) + 1);
            const volumePerDay = task.estimatedTime / dayCount;

            // Iterate over each day of the task and apply to volumes map if within range
            let d = taskStart;
            while (d <= taskEnd) {
                const dKey = format(d, 'yyyy-MM-dd');
                if (volumes[dKey]) {
                    volumes[dKey].workVolume += volumePerDay;
                    volumes[dKey].totalVolume += volumePerDay;
                    volumes[dKey].tasks.push(task);
                }
                d = addDays(d, 1);
            }
        });

        // Calculate load ratios
        Object.values(volumes).forEach(v => {
            const capacity = settings.managementMode === 'Integration'
                ? v.totalCapacity
                : v.workCapacity;

            v.loadRatio = capacity > 0 ? (v.workVolume / capacity) * 100 : 0;
        });

        return volumes;
    }
}
