import { Item, Member, CapacityConfig, FilterMode } from '../types';
import { isHoliday as baseIsHoliday } from './capacity';

export interface QuantityMetric {
    date: Date;
    volumeMinutes: number;
    capacityMinutes: number;
    ratio: number; // volume / capacity
    intensity: number; // 0-100 visual density
    isHoliday: boolean;
    contributingItems: Item[]; // [NEW] Items that add load to this specific day
}

export interface QuantityContext {
    items: Item[];
    members: Member[];
    capacityConfig: CapacityConfig;
    filterMode: FilterMode;
    focusedTenantId?: string | null;
    focusedProjectId?: string | null;
    tenantProfiles?: Map<string, any>; // [NEW] Capacity Profiles (Map<tenantId, Profile>)
    currentUser: {
        id: string;
        isCompanyAccount: boolean;
        joinedTenants: { id: string; name: string }[];
    } | null;
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
        // Ensure current user is consistently evaluated from context
        const { volumeMap, contributorsMap } = this.calculateVolume(context);

        days.forEach(date => {
            const dateKey = date.toDateString();
            const volume = volumeMap.get(dateKey) || 0;
            const capacity = this.calculateCapacityForDate(date, context);
            const isHol = this.checkIsHoliday(date, context);
            const contributors = contributorsMap.get(dateKey) || [];
            const ratio = capacity > 0 ? volume / capacity : (volume > 0 ? 2 : 0);

            metricsMap.set(dateKey, {
                date,
                volumeMinutes: volume,
                capacityMinutes: capacity,
                ratio,
                intensity: this.getIntensity(ratio),
                isHoliday: isHol,
                contributingItems: contributors
            });
        });

        return metricsMap;
    }

    /**
     * Ryokan Logic: Backward allocation from prep_date or due_date.
     */
    private static calculateVolume(context: QuantityContext): {
        volumeMap: Map<string, number>,
        contributorsMap: Map<string, Item[]>
    } {
        const { items, filterMode, focusedTenantId, focusedProjectId, currentUser } = context;
        const volumeMap = new Map<string, number>();
        const contributorsMap = new Map<string, Item[]>();

        if (!currentUser) return { volumeMap, contributorsMap };

        const me = currentUser.id;
        const isCompanyAcc = currentUser.isCompanyAccount;

        // --- View Matrix Logic: Determine Molecule (Relevant Items) ---
        const relevantItems = items.filter(item => {
            // Priority 1: Focus context (Explicitly looking at a project or company)
            if (focusedProjectId) return item.projectId === focusedProjectId;
            if (focusedTenantId) {
                // In Company Focus Mode, show everything for that company (Managerial view)
                // but keep individual owned items visible as truth
                return item.tenantId === focusedTenantId;
            }

            // Priority 2: Global Matrix
            if (!isCompanyAcc) {
                // I am logged in as a Person
                if (filterMode === 'personal') {
                    // Vision: Show only my OWN reality (Personal + Company duties)
                    // Rule: Created by me OR Assigned to me
                    return item.assignedTo === me || item.createdBy === me;
                } else if (filterMode === 'company') {
                    // Vision: Focus on a specific company (from user side)
                    // Rule: Must be this company AND owned by me
                    // If focusedTenantId is not set, we assume 'all my companies' duties?
                    // User Request says: "user selection -> that company duty"
                    // If no focusedTenantId, fall back to owner check across all companies
                    return (item.assignedTo === me || item.createdBy === me) && !!item.tenantId;
                } else {
                    // filterMode === 'all'
                    // Vision: Sum of my life (Personal + All Company duties)
                    return item.assignedTo === me || item.createdBy === me || !item.tenantId;
                }
            } else {
                // I am logged in as a Company (Corporate Identity)
                // Vision: Total load of this business entity
                // If company account, it's always bound to a tenantId (me)
                return item.tenantId === me;
            }
        });

        relevantItems.forEach(item => {
            const endDateRaw = item.prep_date ? (item.prep_date * 1000) : (item.due_date ? new Date(item.due_date).getTime() : null);
            if (endDateRaw) {
                const endDate = new Date(endDateRaw);
                let remainingMinutes = item.estimatedMinutes || (item.work_days ? item.work_days * 480 : 60);

                let current = new Date(endDate);
                let safety = 0;

                while (remainingMinutes > 0 && safety < 90) { // Max 90 days lookback
                    safety++;

                    // Skip holidays for work allocation
                    if (this.checkIsHoliday(current, context)) {
                        current.setDate(current.getDate() - 1);
                        continue;
                    }

                    // For single task allocation, use actual day's capacity or 480 fallback
                    const dailyCapacity = this.calculateCapacityForDate(current, context);
                    if (dailyCapacity <= 0) {
                        current.setDate(current.getDate() - 1);
                        continue;
                    }

                    const alloc = Math.min(remainingMinutes, dailyCapacity);

                    // Normalize date for robust key matching
                    const keyDate = new Date(current);
                    keyDate.setHours(12, 0, 0, 0);
                    const key = keyDate.toDateString();
                    volumeMap.set(key, (volumeMap.get(key) || 0) + alloc);

                    // Add to contributors
                    if (!contributorsMap.has(key)) contributorsMap.set(key, []);
                    if (!contributorsMap.get(key)?.some(i => i.id === item.id)) {
                        contributorsMap.get(key)?.push(item);
                    }

                    // [NEW] Also ensure the item is represented in the list on its "Point of Engagement"
                    // If due_date is missing, use current date if it matches the prep_date start
                    // This is for visual continuity in the calendar cell.

                    remainingMinutes -= alloc;
                    current.setDate(current.getDate() - 1);
                }
            }
        });

        return { volumeMap, contributorsMap };
    }

    /**
     * Capacity Logic: Determine Denominator based on Matrix.
     */
    private static calculateCapacityForDate(date: Date, context: QuantityContext): number {
        const { members, capacityConfig, tenantProfiles, focusedTenantId, filterMode, currentUser } = context;

        if (!currentUser) return 0;
        const isCompanyAcc = currentUser.isCompanyAccount;
        const isHol = this.checkIsHoliday(date, context);

        // 1. Identification: Who is the subject?
        // If Company Account -> Use Member aggregation logic (Legacy/Enterprise)
        if (isCompanyAcc) {
            const mainMembers = members.filter(m => m.isCore);
            if (mainMembers.length > 0 && !isHol) {
                return mainMembers.reduce((sum, m) => sum + (m.dailyCapacityMinutes || 480), 0);
            }
            return 0;
        }

        // 2. Personal Account: Tenant-based Capacity Aggregation
        // Determine which tenants to include in the sum
        let targetTenantIds: string[] = [];

        if (focusedTenantId) {
            targetTenantIds = [focusedTenantId];
        } else if (filterMode === 'company') {
            // In Company Mode (without specific focus), we sum all tenants that the user belongs to?
            // Or adhere to context. In current UI, 'Company' usually means 'Work'.
            // Let's sum all joined tenants for 'Company' mode to represent "Total Work Capacity".
            // Note: If distinct separation is needed, UI should enforce focusedTenantId.
            targetTenantIds = currentUser.joinedTenants.map(t => t.id);
        } else {
            // 'personal' or 'all' -> Sum all capacities (Life + Work)
            // Personal usually entails private tasks too.
            // For now, we sum up all tenancy capacities.
            // Private capacity is handled via Default fallback if no tenants?
            // Actually, 'Personal' filter often implies "My Tasks".
            // If I have 2 companies, my capacity is Sum(A + B).
            targetTenantIds = currentUser.joinedTenants.map(t => t.id);
        }

        let totalCap = 0;
        const dateKey = this.formatDateKey(date);
        const dayOfWeek = date.getDay();

        // 3. Calculation per Tenant
        if (targetTenantIds.length === 0) {
            // No tenants (Private only?) -> Use System Default
            return isHol ? 0 : (capacityConfig.defaultDailyMinutes || 480);
        }

        // Logic: specific setting > pattern > default
        // let hasMatchedProfile = false; // [Deleted] Unused

        targetTenantIds.forEach(tid => {
            const profile = tenantProfiles?.get(tid);
            let tenantMinutes = 0;

            if (profile) {
                // hasMatchedProfile = true; 
                const standard = profile.standardWeeklyPattern;
                const exceptions = profile.exceptions;

                // Priority 1: Exception
                if (exceptions && exceptions[dateKey] !== undefined) {
                    tenantMinutes = exceptions[dateKey];
                }
                // Priority 2: Holiday (System/Global) 
                // Note: If Exception is set (e.g. 0 or 480), it overrides Holiday check above.
                // If NO exception, Holiday takes precedence over Weekly.
                else if (isHol) {
                    tenantMinutes = 0;
                }
                // Priority 3: Weekly Pattern
                else if (standard && standard[dayOfWeek] !== undefined) {
                    tenantMinutes = standard[dayOfWeek];
                }
                // Priority 4: Default (Fallback for profile gap)
                else {
                    tenantMinutes = capacityConfig.defaultDailyMinutes || 480;
                }
            } else {
                // No Profile for this tenant -> Use System Default
                if (isHol) {
                    tenantMinutes = 0;
                } else {
                    tenantMinutes = capacityConfig.defaultDailyMinutes || 480;
                }
            }
            totalCap += tenantMinutes;
        });

        // Special Case: "All" mode or "Personal" mode might imply pure private capacity if no tenants?
        // But logic above handles targetTenantIds.length === 0.

        return totalCap;
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

    private static formatDateKey(date: Date): string {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
}
