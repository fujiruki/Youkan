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
        const { focusedTenantId } = context;

        days.forEach(date => {
            const dateKey = date.toDateString();
            const volume = volumeMap.get(dateKey) || 0;
            // [NEW] Use focusedTenantId if available to show specific capacity for that company
            const capacity = this.calculateCapacityForDate(date, context, focusedTenantId);
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
            // [Engine] Priority: prep_date (My Deadline) > due_date (Official Deadline)
            const endDateRaw = (item.prep_date ? item.prep_date * 1000 : null) || (item.due_date ? new Date(item.due_date).getTime() : null);

            if (endDateRaw) {
                const endDate = new Date(endDateRaw);
                let remainingMinutes = item.estimatedMinutes || (item.work_days ? item.work_days * 480 : 60);

                // [NEW] Visual Engagement Point: Always register item on its primary deadline date for UI Chip visibility
                // even if capacity is 0 on that specific day.
                const startKeyDate = new Date(endDate);
                startKeyDate.setHours(12, 0, 0, 0);
                const startKey = startKeyDate.toDateString();
                if (!contributorsMap.has(startKey)) contributorsMap.set(startKey, []);
                if (!contributorsMap.get(startKey)?.some(i => i.id === item.id)) {
                    contributorsMap.get(startKey)?.push(item);
                }

                let current = new Date(endDate);
                let safety = 0;

                while (remainingMinutes > 0 && safety < 90) { // Max 90 days lookback
                    safety++;

                    // Skip holidays for work allocation
                    if (this.checkIsHoliday(current, context)) {
                        current.setDate(current.getDate() - 1);
                        continue;
                    }

                    // [NEW] Use item's specific company capacity if available
                    const dailyCapacity = this.calculateCapacityForDate(current, context, item.tenantId);
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

                    // Add to contributors for work days
                    if (!contributorsMap.has(key)) contributorsMap.set(key, []);
                    if (!contributorsMap.get(key)?.some(i => i.id === item.id)) {
                        contributorsMap.get(key)?.push(item);
                    }

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
    private static calculateCapacityForDate(date: Date, context: QuantityContext, forTenantId?: string | null): number {
        const { members, capacityConfig, tenantProfiles, focusedTenantId, filterMode, currentUser } = context;

        if (!currentUser) return 0;
        const isCompanyAcc = currentUser.isCompanyAccount;
        const isHol = this.checkIsHoliday(date, context);
        const dateKey = this.formatDateKey(date);
        const dayOfWeek = date.getDay();

        // --- Core Allocation Logic (Company Specific) ---
        // Priority 1: Specific Target Tenant (A社のみ、B社のみ等)
        const targetId = forTenantId !== undefined ? forTenantId : focusedTenantId;
        if (targetId) {
            // Check Company Specific Allocation first
            const companyException = capacityConfig.dailyCompanyExceptions?.[dateKey];
            if (companyException && companyException[targetId] !== undefined) {
                return companyException[targetId];
            }

            if (isHol) return 0;

            const companyPattern = capacityConfig.defaultCompanyWeeklyPattern?.[dayOfWeek];
            if (companyPattern && companyPattern[targetId] !== undefined) {
                return companyPattern[targetId];
            }

            // If no company-specific allocation but it's a company focus, 
            // maybe it should fallback or be 0? Sum logic is handled below if no specific ID.
            // For now, if specified but not found, we assume 0 for that specific company context.
            if (forTenantId !== undefined) return 0;
        }

        // --- Aggregation Logic (General Matrix) ---

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
        let targetTenantIds: string[] = [];

        if (focusedTenantId) {
            targetTenantIds = [focusedTenantId];
        } else if (filterMode === 'company') {
            targetTenantIds = currentUser.joinedTenants.map(t => t.id);
        } else {
            // Sum all (including Personal)
            targetTenantIds = currentUser.joinedTenants.map(t => t.id);
            // If No Tenants but 'all' mode, we usually use default base capacity
        }

        let totalCap = 0;

        // 3. Calculation per Tenant
        if (targetTenantIds.length === 0) {
            if (isHol) return 0;
            // [FIX] standardWeeklyPattern を優先、なければ defaultDailyMinutes
            const weeklyVal = capacityConfig.standardWeeklyPattern?.[dayOfWeek];
            return weeklyVal !== undefined ? weeklyVal : (capacityConfig.defaultDailyMinutes || 480);
        }

        let standardAdded = false;
        targetTenantIds.forEach(tid => {
            // Check Company Allocations first (New Logic)
            const companyEx = capacityConfig.dailyCompanyExceptions?.[dateKey];
            if (companyEx && companyEx[tid] !== undefined) {
                totalCap += companyEx[tid];
                return;
            }

            if (isHol) return;

            const companyPat = capacityConfig.defaultCompanyWeeklyPattern?.[dayOfWeek];
            if (companyPat && companyPat[tid] !== undefined) {
                totalCap += companyPat[tid];
                return;
            }

            // Fallback: standardWeeklyPattern → tenantProfiles → defaultDailyMinutes
            // [FIX] Avoid double-counting standard capacity for personal accounts.
            if (!standardAdded) {
                const weeklyPatternVal = capacityConfig.standardWeeklyPattern?.[dayOfWeek];
                if (weeklyPatternVal !== undefined) {
                    totalCap += weeklyPatternVal;
                    standardAdded = true;
                    return;
                }

                const profile = tenantProfiles?.get(tid);
                let tenantMinutes = 0;

                if (profile) {
                    const standard = profile.standardWeeklyPattern;
                    const exceptions = profile.exceptions;

                    if (exceptions && exceptions[dateKey] !== undefined) {
                        tenantMinutes = exceptions[dateKey];
                    }
                    else if (standard && standard[dayOfWeek] !== undefined) {
                        tenantMinutes = standard[dayOfWeek];
                    }
                    else {
                        tenantMinutes = capacityConfig.defaultDailyMinutes || 480;
                    }
                } else {
                    tenantMinutes = capacityConfig.defaultDailyMinutes || 480;
                }
                totalCap += tenantMinutes;
                standardAdded = true;
            }
        });


        return totalCap;
    }

    static calculateAllocationDays(endDate: Date, estimatedMinutes: number, context: QuantityContext, tenantId?: string | null): Date[] {
        const days: Date[] = [];
        let remainingMinutes = estimatedMinutes || 60;
        let current = new Date(endDate);
        let safety = 0;

        while (remainingMinutes > 0 && safety < 90) {
            safety++;
            const isHol = this.checkIsHoliday(current, context);
            const dailyCapacity = this.calculateCapacityForDate(current, context, tenantId);

            if (isHol || dailyCapacity <= 0) {
                current.setDate(current.getDate() - 1);
                continue;
            }

            const alloc = Math.min(remainingMinutes, dailyCapacity);
            days.push(new Date(current));
            remainingMinutes -= alloc;
            current.setDate(current.getDate() - 1);
        }
        return days;
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
