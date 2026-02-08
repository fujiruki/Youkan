import { format, parseISO, addDays, subDays, getDay } from 'date-fns';

export interface TaskVolume {
    id: string;
    title: string;
    projectId: string;
    projectTitle: string;
    estimatedTime: number; // hours
    dueDate: string; // YYYY-MM-DD (Absolute Deadline)
    myDueDate: string; // YYYY-MM-DD (User target deadline for packing)
    contextId: string; // 'personal' or companyId
}

export interface ContextCapacity {
    contextId: string;
    weeklySchedule: number[]; // [Sun, Mon, Tue, Wed, Thu, Fri, Sat] in hours
}

export interface VolumeSettings {
    contexts: ContextCapacity[];
    nothingDays: string[]; // YYYY-MM-DD list of absolute rest days
    managementMode: 'Separation' | 'Integration'; // Separation: Filter strictly, Integration: Sum all
}

export interface DailyVolume {
    date: string;
    loadByContext: Record<string, number>; // contextId -> consumed hours
    capacityByContext: Record<string, number>; // contextId -> max hours
    totalLoad: number;
    totalCapacity: number;
    loadRatio: number; // percentage based on filter
    tasksEndingOnThisDay: TaskVolume[]; // Deadlines fall here
    tasksContributingToThisDay: TaskVolume[]; // Work is being done here
    isNothingDay: boolean;
}

export class VolumeService {
    /**
     * Calculates daily volumes using the Sequential Packing (Backward Consumption) Engine.
     */
    static calculateDailyVolumes(
        tasks: TaskVolume[],
        settings: VolumeSettings,
        viewStartDateStr: string,
        viewEndDateStr: string,
        filterContextId: string | 'all' | 'company' = 'all'
    ): Record<string, DailyVolume> {
        const volumes: Record<string, DailyVolume> = {};

        // We need a wider calculation range to account for tasks that start before viewStartDate
        // because of backward packing. Let's calculate for a broad enough range (e.g., 3 months).
        const viewStart = parseISO(viewStartDateStr);
        const viewEnd = parseISO(viewEndDateStr);

        // Preparation: Initialize volumes for the requested view range
        let current = viewStart;
        while (current <= viewEnd) {
            const dateKey = format(current, 'yyyy-MM-dd');
            volumes[dateKey] = this.createEmptyDailyVolume(dateKey, settings);
            current = addDays(current, 1);
        }

        // Sequential Packing Engine
        // 1. Sort tasks by My Due Date (earlier dates first get the "closer" slots)
        const sortedTasks = [...tasks].sort((a, b) => a.myDueDate.localeCompare(b.myDueDate));

        // 2. Available Capacity Tracking (Registry)
        // date string -> contextId -> available hours
        const capacityRegistry: Record<string, Record<string, number>> = {};

        const getCapacity = (dateStr: string, cid: string): number => {
            if (settings.nothingDays.includes(dateStr)) return 0;
            if (!capacityRegistry[dateStr]) {
                capacityRegistry[dateStr] = {};
                const date = parseISO(dateStr);
                const dayIdx = getDay(date);
                settings.contexts.forEach(c => {
                    capacityRegistry[dateStr][c.contextId] = c.weeklySchedule[dayIdx];
                });
            }
            return capacityRegistry[dateStr][cid] || 0;
        };

        const consumeCapacity = (dateStr: string, cid: string, hours: number) => {
            if (!capacityRegistry[dateStr]) getCapacity(dateStr, cid);
            capacityRegistry[dateStr][cid] -= hours;
        };

        // 3. Process each task backward from myDueDate
        sortedTasks.forEach(task => {
            let remaining = task.estimatedTime;
            let checkDate = parseISO(task.myDueDate);
            const limitDate = subDays(checkDate, 60); // Safety limit to prevent infinite loops

            while (remaining > 0 && checkDate >= limitDate) {
                const dateKey = format(checkDate, 'yyyy-MM-dd');
                const avail = getCapacity(dateKey, task.contextId);

                if (avail > 0) {
                    const consumption = Math.min(remaining, avail);
                    consumeCapacity(dateKey, task.contextId, consumption);
                    remaining -= consumption;

                    // If this date is in our view range, record the contribution
                    if (volumes[dateKey]) {
                        volumes[dateKey].loadByContext[task.contextId] += consumption;
                        volumes[dateKey].totalLoad += consumption;
                        volumes[dateKey].tasksContributingToThisDay.push(task);
                    }
                }
                checkDate = subDays(checkDate, 1);
            }

            // Also record the deadline card
            const dueKey = task.dueDate;
            if (volumes[dueKey]) {
                volumes[dueKey].tasksEndingOnThisDay.push(task);
            }
        });

        // 4. Finalize Load Ratios based on filter
        Object.values(volumes).forEach(v => {
            let activeLoad = 0;
            let activeCap = 0;

            if (filterContextId === 'all') {
                activeLoad = v.totalLoad;
                activeCap = v.totalCapacity;
            } else if (filterContextId === 'company') {
                // Sum all contexts except 'personal'
                activeLoad = Object.entries(v.loadByContext)
                    .filter(([cid]) => cid !== 'personal')
                    .reduce((sum, [, load]) => sum + load, 0);
                activeCap = Object.entries(v.capacityByContext)
                    .filter(([cid]) => cid !== 'personal')
                    .reduce((sum, [, cap]) => sum + cap, 0);
            } else {
                activeLoad = v.loadByContext[filterContextId] || 0;
                activeCap = v.capacityByContext[filterContextId] || 0;
            }

            v.loadRatio = activeCap > 0 ? (activeLoad / activeCap) * 100 : (activeLoad > 0 ? 999 : 0);
        });

        return volumes;
    }

    private static createEmptyDailyVolume(dateKey: string, settings: VolumeSettings): DailyVolume {
        const date = parseISO(dateKey);
        const dayIdx = getDay(date);
        const isNothingDay = settings.nothingDays.includes(dateKey);

        const loadByContext: Record<string, number> = {};
        const capacityByContext: Record<string, number> = {};
        let totalCapacity = 0;

        settings.contexts.forEach(c => {
            loadByContext[c.contextId] = 0;
            const cap = isNothingDay ? 0 : c.weeklySchedule[dayIdx];
            capacityByContext[c.contextId] = cap;
            totalCapacity += cap;
        });

        return {
            date: dateKey,
            loadByContext,
            capacityByContext,
            totalLoad: 0,
            totalCapacity,
            loadRatio: 0,
            tasksEndingOnThisDay: [],
            tasksContributingToThisDay: [],
            isNothingDay
        };
    }
}
