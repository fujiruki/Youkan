import { Item, Member, CapacityConfig, FilterMode } from '../types';
import { isHoliday as baseIsHoliday } from './capacity';

export interface QuantityMetric {
    date: Date;
    volumeMinutes: number;
    capacityMinutes: number;
    ratio: number; // volume / capacity
    isHoliday: boolean;
    contributingItems: Item[]; // Items that add load to this specific day
    deadlineItems: Item[];      // [NEW] Items that have their primary deadline on this day
}

export interface QuantityContext {
    items: Item[];
    members: Member[];
    capacityConfig: CapacityConfig;
    filterMode: FilterMode;
    focusedTenantId?: string | null;
    focusedProjectId?: string | null;
}

/**
 * JBWOS Quantity Engine
 * Handles volume allocation and capacity calculation based on JBWOS philosophy.
 */
export class QuantityEngine {

    /**
     * Calculates the daily metrics for a range of days.
     */
    static calculateMetrics(
        days: Date[],
        context: QuantityContext
    ): Map<string, QuantityMetric> {
        const metricsMap = new Map<string, QuantityMetric>();
        const { volumeMap, contributorsMap, deadlinesMap } = this.calculateVolume(context);

        days.forEach(date => {
            const dateKey = date.toDateString();
            const volume = volumeMap.get(dateKey) || 0;
            const capacity = this.calculateCapacityForDate(date, context);
            const isHol = this.checkIsHoliday(date, context);
            const contributors = contributorsMap.get(dateKey) || [];
            const deadlines = deadlinesMap.get(dateKey) || [];

            metricsMap.set(dateKey, {
                date,
                volumeMinutes: volume,
                capacityMinutes: capacity,
                ratio: capacity > 0 ? volume / capacity : (volume > 0 ? 2 : 0),
                isHoliday: isHol,
                contributingItems: contributors,
                deadlineItems: deadlines
            });
        });

        return metricsMap;
    }

    /**
     * Ryokan Logic: Backward allocation from prep_date or due_date.
     */
    private static calculateVolume(context: QuantityContext): {
        volumeMap: Map<string, number>,
        contributorsMap: Map<string, Item[]>,
        deadlinesMap: Map<string, Item[]>
    } {
        const { items, filterMode, focusedTenantId, focusedProjectId } = context;
        const volumeMap = new Map<string, number>();
        const contributorsMap = new Map<string, Item[]>();
        const deadlinesMap = new Map<string, Item[]>();

        // Filter items based on viewing context
        const relevantItems = items.filter(item => {
            // Project Focus
            if (focusedProjectId && item.projectId === focusedProjectId) return true;
            if (focusedProjectId && item.id === focusedProjectId) return false; // Don't count the project itself

            // Company Focus (Tenant)
            if (focusedTenantId && item.tenantId === focusedTenantId) return true;

            // Global Filter Mode
            if (filterMode === 'company') return !!item.tenantId;
            if (filterMode === 'personal') return !item.tenantId;

            return true; // 'all'
        });

        relevantItems.forEach(item => {
            // [NEW] Backward allocation base: use prep_date if exists, otherwise use due_date
            const baseDateSource = item.prep_date ? new Date(item.prep_date * 1000) : (item.due_date ? new Date(item.due_date) : null);

            if (baseDateSource && !isNaN(baseDateSource.getTime())) {
                let remainingMinutes = item.estimatedMinutes || (item.work_days ? item.work_days * 480 : 60);

                let current = new Date(baseDateSource);
                let safety = 0;

                while (remainingMinutes > 0 && safety < 90) { // Max 90 days lookback
                    safety++;

                    // Skip holidays for work allocation
                    if (this.checkIsHoliday(current, context)) {
                        current.setDate(current.getDate() - 1);
                        continue;
                    }

                    // For single task allocation, use 8h cap per day as default chunk
                    const dailyChunk = 480;
                    const alloc = Math.min(remainingMinutes, dailyChunk);

                    const key = current.toDateString();
                    volumeMap.set(key, (volumeMap.get(key) || 0) + alloc);

                    // Add to contributors
                    if (!contributorsMap.has(key)) contributorsMap.set(key, []);
                    if (!contributorsMap.get(key)?.some(i => i.id === item.id)) {
                        contributorsMap.get(key)?.push(item);
                    }

                    remainingMinutes -= alloc;
                    current.setDate(current.getDate() - 1);
                }
            }

            // [NEW] Deadline Card logic: Show on due_date if exists, otherwise on prep_date
            const primaryDeadline = item.due_date ? new Date(item.due_date) : (item.prep_date ? new Date(item.prep_date * 1000) : null);
            if (primaryDeadline && !isNaN(primaryDeadline.getTime())) {
                const dkey = primaryDeadline.toDateString();
                if (!deadlinesMap.has(dkey)) deadlinesMap.set(dkey, []);
                deadlinesMap.get(dkey)?.push(item);
            }
        });

        return { volumeMap, contributorsMap, deadlinesMap };
    }

    /**
     * Capacity Logic: Sum of members or personal capacity.
     */
    private static calculateCapacityForDate(date: Date, context: QuantityContext): number {
        const { members, capacityConfig, focusedTenantId, focusedProjectId, filterMode } = context;

        // 1. Organizational View (Company or Project) -> Sum of Main Members
        if (focusedTenantId || focusedProjectId || filterMode === 'company') {
            const mainMembers = members.filter(m => m.isCore);
            if (mainMembers.length > 0) {
                // TODO: In actual implementation, check each member's personal holiday
                // For now, use global holiday rule and sum their daily capacity
                if (this.checkIsHoliday(date, context)) return 0;
                return mainMembers.reduce((sum, m) => sum + (m.dailyCapacityMinutes || 480), 0);
            }
        }

        // 2. Personal View
        if (this.checkIsHoliday(date, context)) return 0;
        return capacityConfig.defaultDailyMinutes || 480;
    }

    private static checkIsHoliday(date: Date, context: QuantityContext): boolean {
        // Wrap existing capacity.ts logic
        return baseIsHoliday(date, context.capacityConfig);
    }

    /**
     * Map volume ratio to visual intensity (0-100)
     */
    static getIntensity(ratio: number): number {
        // 0% -> 0
        // 100% -> 70
        // 150%+ -> 100
        return Math.min(ratio * 70, 100);
    }
}
