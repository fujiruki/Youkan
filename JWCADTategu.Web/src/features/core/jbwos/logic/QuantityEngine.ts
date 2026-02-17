import { Item, Member, CapacityConfig, FilterMode } from '../types';
import { isHoliday as baseIsHoliday } from './capacity';
import { safeParseDate, normalizeDateKey } from './dateUtils';

export interface QuantityMetric {
    date: Date;
    volumeMinutes: number;
    capacityMinutes: number;
    ratio: number; // volume / capacity
    intensity: number; // 0-100 visual density
    isHoliday: boolean;
    contributingItems: Item[]; // [NEW] Items that add load to this specific day
}

export interface AllocationStep {
    date: Date;
    allocatedMinutes: number;
    capacityMinutes: number;
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
     * Structure for detailed allocation breakdown
     */
    static calculateAllocationDetails(endDate: Date, estimatedMinutes: number, context: QuantityContext, tenantId?: string | null): AllocationStep[] {
        const steps: AllocationStep[] = [];
        let remainingMinutes = estimatedMinutes || 60;
        let current = new Date(endDate);
        let safety = 0;

        console.log(`[QuantityEngine] Allocation Details Start: total=${estimatedMinutes}, anchor=${endDate.toDateString()}`); // [DEBUG]

        while (remainingMinutes > 0 && safety < 90) {
            safety++;
            const isHol = this.checkIsHoliday(current, context);
            const dailyCapacity = this.calculateCapacityForDate(current, context, tenantId);

            // Normalize for logs
            const dateStr = current.toDateString();

            if (isHol || dailyCapacity <= 0) {
                console.log(`[QuantityEngine] Allocation Skip: ${dateStr} (Hol=${isHol}, Cap=${dailyCapacity})`); // [DEBUG]
                current.setDate(current.getDate() - 1);
                continue;
            }

            const alloc = Math.min(remainingMinutes, dailyCapacity);
            console.log(`[QuantityEngine] Allocation Step: ${dateStr} (Alloc=${alloc}, Rem=${remainingMinutes - alloc}, Cap=${dailyCapacity})`); // [DEBUG]

            // [FIX] Normalize date to 00:00:00 to match CalendarCell logic
            const stepDate = new Date(current);
            stepDate.setHours(0, 0, 0, 0);

            steps.push({
                date: stepDate,
                allocatedMinutes: alloc,
                capacityMinutes: dailyCapacity
            });
            remainingMinutes -= alloc;

            // 重要: 次の日の計算に移る
            current.setDate(current.getDate() - 1);
        }

        console.log(`[QuantityEngine] Allocation Finished: steps=${steps.length}`); // [DEBUG]
        // Sort by date ascending (oldest first)
        return steps.sort((a, b) => a.date.getTime() - b.date.getTime());
    }

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

        days.forEach((date, i) => {
            // [DEBUG] Pinpoint Log
            // if (i === 0 || i === days.length - 1) console.log(`[QuantityEngine] Processing day ${i}: type=${typeof date}, val=${date}`);

            // Step 1: Normalize
            const dateKey = normalizeDateKey(date);

            // Step 2: Get Volume
            const volume = volumeMap.get(dateKey) || 0;

            // Step 3: Get Capacity
            // [DEBUG] Check date validity before calling capacity logic
            if (isNaN(date.getTime())) {
                console.error(`[QuantityEngine] Invalid Date encountered at index ${i}`, date);
            }
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
            const endDate = safeParseDate(item.prep_date || item.due_date);

            if (endDate) {
                let remainingMinutes = item.estimatedMinutes || (item.work_days ? item.work_days * 480 : 60);

                // [NEW] Visual Engagement Point: Always register item on its primary deadline date for UI Chip visibility
                // even if capacity is 0 on that specific day.
                const startKey = normalizeDateKey(endDate);
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
                    const key = normalizeDateKey(current);
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
        const { capacityConfig, focusedTenantId, filterMode, currentUser } = context;

        if (!currentUser) return 0;

        const isHol = this.checkIsHoliday(date, context);
        const dateKey = this.formatDateKey(date);
        const dayOfWeek = date.getDay();

        // --- Core Allocation Logic (Company Specific Priority) ---
        // Priority 1: Specific Context (フィルタで絞り込まれている、または特定の会社枠を表示したい場合)
        const targetId = forTenantId !== undefined ? forTenantId : focusedTenantId;

        if (targetId) {
            const companyException = capacityConfig.dailyCompanyExceptions?.[dateKey];
            if (companyException && companyException[targetId] !== undefined) {
                const val = companyException[targetId];
                console.log(`[QuantityEngine] Capacity Match (Company Exception): date=${dateKey}, tenant=${targetId}, val=${val}`);
                return val;
            }

            if (isHol) {
                console.log(`[QuantityEngine] Capacity Skip (Holiday): date=${dateKey}`);
                return 0;
            }

            const companyPattern = capacityConfig.defaultCompanyWeeklyPattern?.[dayOfWeek];
            if (companyPattern && companyPattern[targetId] !== undefined) {
                const val = companyPattern[targetId];
                console.log(`[QuantityEngine] Capacity Match (Company Weekly): date=${dateKey}, tenant=${targetId}, val=${val}`);
                return val;
            }

            // 【重要】特定の組織 ID が指定された（フィルタ中 or アイテム所属）が、その組織に設定がない場合、
            // フィルタモードが 'all' なら個人設定（一日の総量）へフォールバックする。
            if (filterMode !== 'all') {
                console.log(`[QuantityEngine] Capacity Zero (Filter Restricted): date=${dateKey}, filterMode=${filterMode}, target=${targetId}`);
                return 0; // 絞り込み中は他社の時間は使えない
            }
            console.log(`[QuantityEngine] Capacity Fallback Attempt: date=${dateKey}, target=${targetId} has no specific setting.`);
        }

        // --- Fallback Logic: Personal Standard Capacity (Molecule of Reality) ---
        // 会社枠に設定がない、または Private アイテムの場合。
        if (isHol) return 0;

        // standardWeeklyPattern -> defaultDailyMinutes
        const weeklyVal = capacityConfig.standardWeeklyPattern?.[dayOfWeek];
        const result = weeklyVal !== undefined ? weeklyVal : (capacityConfig.defaultDailyMinutes || 480);

        // console.log(`[QuantityEngine] Capacity Personal Result: ...`); // [REMOVED] Reduce noise
        return result;
    }

    static calculateAllocationDays(endDate: Date, estimatedMinutes: number, context: QuantityContext, tenantId?: string | null): Date[] {
        // [Refactor] Use detail logic and just map to dates
        const details = this.calculateAllocationDetails(endDate, estimatedMinutes, context, tenantId);
        // Returns dates in reverse chronological order (as original logic pushed backwards)
        // Original logic pushed backwards: [EndDate, EndDate-1, ...]
        // calculateAllocationDetails sorts ascending: [Oldest, ..., EndDate]
        // We should return them in ascending order for calendar highlight usually?
        // Wait, original logic was: days.push(current) (Backwards). So [EndDate, EndDate-1, ...]
        // BUT, usually callers just need the Set of dates.
        // Let's reverse it to match original "days" array order if strictly needed,
        // but typically Date[] is used for "contains" check.
        // Let's return ascending for sanity.
        return details.map(s => s.date);
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
