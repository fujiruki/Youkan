import { Item, Member, CapacityConfig, FilterMode } from '../types';
import { isHoliday as baseIsHoliday } from './capacity';
import { safeParseDate, normalizeDateKey } from './dateUtils';
import { ExternalEvent, DEFAULT_ALL_DAY_WEIGHT_MINUTES } from '../types/externalEvent';

export interface QuantityMetric {
    date: Date;
    volumeMinutes: number;
    /** R-035: volumeMinutes のうち status=done のアイテム由来の合計（進捗棒グラフの完了部分の分子） */
    completedVolumeMinutes: number;
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
    filterMode?: FilterMode;
    focusedTenantId?: string | null;
    focusedProjectId?: string | null;
    tenantProfiles?: Map<string, any>; // [NEW] Capacity Profiles (Map<tenantId, Profile>)
    currentUser: {
        id: string;
        isCompanyAccount: boolean;
        joinedTenants: { id: string; name: string }[];
    } | null;
    useTeamCapacity?: boolean;
    teamCapacityTenantId?: string | null;
}

/**
 * Youkan Quantity Engine
 * Handles volume allocation and capacity calculation based on Youkan philosophy.
 */
export class QuantityEngine {

    /**
     * Structure for detailed allocation breakdown
     */
    static calculateAllocationDetails(endDate: Date, estimatedMinutes: number, context: QuantityContext, tenantId?: string | null): AllocationStep[] {
        const capacityCache = new Map<string, number>();
        const { steps } = this.allocateBackwardsCore(endDate, estimatedMinutes, context, tenantId, capacityCache);
        return steps;
    }

    /**
     * Calculates the daily metrics for a range of days.
     *
     * @param externalEvents R-034 Phase 2: 日付キーをキーとする Google カレンダー
     *                       イベント一覧。各イベントの所要時間を量感の分子に加算する。
     *                       終日イベントは `allDayWeightMinutes`（デフォルト 240 分）。
     *                       重複イベント（時間帯被り）は二重加算する（事実重視）。
     */
    static calculateMetrics(
        days: Date[],
        context: QuantityContext,
        externalEvents?: Map<string, ExternalEvent[]>,
        allDayWeightMinutes: number = DEFAULT_ALL_DAY_WEIGHT_MINUTES
    ): Map<string, QuantityMetric> {
        const metricsMap = new Map<string, QuantityMetric>();
        const capacityCache = new Map<string, number>();
        // Ensure current user is consistently evaluated from context
        const { volumeMap, completedVolumeMap, contributorsMap } = this.calculateVolume(context, capacityCache);
        const { focusedTenantId } = context;

        const externalVolumeMap = this.calculateExternalVolume(externalEvents, allDayWeightMinutes);

        days.forEach((date, i) => {
            // [DEBUG] Pinpoint Log
            // if (i === 0 || i === days.length - 1) console.log(`[QuantityEngine] Processing day ${i}: type=${typeof date}, val=${date}`);

            // Step 1: Normalize
            const dateKey = normalizeDateKey(date);

            // Step 2: Get Volume
            const taskVolume = volumeMap.get(dateKey) || 0;
            const ymdKey = this.formatDateKey(date);
            const externalVolume = externalVolumeMap.get(dateKey) || externalVolumeMap.get(ymdKey) || 0;
            const volume = taskVolume + externalVolume;
            const completedVolume = completedVolumeMap.get(dateKey) || 0;

            // Step 3: Get Capacity
            // [DEBUG] Check date validity before calling capacity logic
            if (isNaN(date.getTime())) {
                console.error(`[QuantityEngine] Invalid Date encountered at index ${i}`, date);
            }
            const capacity = this.calculateCapacityForDate(date, context, focusedTenantId, capacityCache);

            const isHol = this.checkIsHoliday(date, context);
            const contributors = contributorsMap.get(dateKey) || [];
            const ratio = capacity > 0 ? volume / capacity : (volume > 0 ? 2 : 0);

            metricsMap.set(dateKey, {
                date,
                volumeMinutes: volume,
                completedVolumeMinutes: completedVolume,
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
     * R-034 Phase 2: Google カレンダー外部イベントを日付キー別の合計分に集計する。
     *
     * - 時間指定: `(endAt - startAt) / 60` を分として加算
     * - 終日: `allDayWeightMinutes`（デフォルト 240 分）を 1 件あたり加算
     * - 重複イベント（時間帯被り）は仕様通り二重加算する（事実重視）
     */
    static calculateExternalVolume(
        externalEvents: Map<string, ExternalEvent[]> | undefined,
        allDayWeightMinutes: number = DEFAULT_ALL_DAY_WEIGHT_MINUTES
    ): Map<string, number> {
        const result = new Map<string, number>();
        if (!externalEvents || externalEvents.size === 0) return result;

        externalEvents.forEach((events, dateKey) => {
            let total = 0;
            for (const ev of events) {
                if (ev.allDay) {
                    total += allDayWeightMinutes;
                } else {
                    const minutes = Math.max(0, Math.round((ev.endAt - ev.startAt) / 60));
                    total += minutes;
                }
            }
            if (total > 0) {
                result.set(dateKey, (result.get(dateKey) || 0) + total);
            }
        });
        return result;
    }

    /**
     * Ryokan Logic: Backward allocation from prep_date or due_date.
     */
    private static calculateVolume(context: QuantityContext, capacityCache?: Map<string, number>): {
        volumeMap: Map<string, number>,
        completedVolumeMap: Map<string, number>,
        contributorsMap: Map<string, Item[]>
    } {
        const { items, focusedTenantId, focusedProjectId } = context;
        const volumeMap = new Map<string, number>();
        const completedVolumeMap = new Map<string, number>();
        const contributorsMap = new Map<string, Item[]>();

        // Filtering is done upstream by ViewModel.
        // QuantityEngine receives pre-filtered items and processes all of them.
        // someday アイテムはキャパシティ計算から除外する
        const baseItems = items.filter(item => item.status !== 'someday');
        const relevantItems = focusedProjectId
            ? baseItems.filter(item => item.projectId === focusedProjectId)
            : focusedTenantId
                ? baseItems.filter(item => item.tenantId === focusedTenantId)
                : baseItems;

        relevantItems.forEach(item => {
            const endDate = safeParseDate(item.prep_date || item.due_date);
            if (endDate) {
                const totalMinutes = item.estimatedMinutes || (item.work_days ? item.work_days * 480 : 60);
                const { steps } = this.allocateBackwardsCore(endDate, totalMinutes, context, item.tenantId, capacityCache);
                // R-035: done アイテムは「完了済み量感」として別途集計し、進捗棒グラフの完了部分へ反映する
                const isDone = (item.status as string) === 'done';

                // [NEW] Visual Engagement Point: Always register item on its primary deadline date for UI Chip visibility
                const startKey = normalizeDateKey(endDate);
                if (!contributorsMap.has(startKey)) contributorsMap.set(startKey, []);
                if (!contributorsMap.get(startKey)?.some(i => i.id === item.id)) {
                    contributorsMap.get(startKey)?.push(item);
                }

                steps.forEach(step => {
                    const key = normalizeDateKey(step.date);
                    volumeMap.set(key, (volumeMap.get(key) || 0) + step.allocatedMinutes);
                    if (isDone) {
                        completedVolumeMap.set(key, (completedVolumeMap.get(key) || 0) + step.allocatedMinutes);
                    }

                    if (!contributorsMap.has(key)) contributorsMap.set(key, []);
                    if (!contributorsMap.get(key)?.some(i => i.id === item.id)) {
                        contributorsMap.get(key)?.push(item);
                    }
                });
            }
        });

        return { volumeMap, completedVolumeMap, contributorsMap };
    }

    /**
     * Capacity Logic: Determine Denominator based on Matrix.
     */
    private static calculateCapacityForDate(date: Date, context: QuantityContext, forTenantId?: string | null, capacityCache?: Map<string, number>): number {
        const { capacityConfig, focusedTenantId, currentUser, filterMode = 'all', useTeamCapacity } = context;

        if (!currentUser) return 0;

        const dateKey = this.formatDateKey(date);
        const filterTenantId = this.getTenantIdFromFilterMode(filterMode);
        const targetId = forTenantId !== undefined ? forTenantId : (focusedTenantId ?? filterTenantId);
        const isTeamScope = useTeamCapacity || currentUser.isCompanyAccount;
        const cacheKey = `${dateKey}|${targetId ?? ''}|${filterMode}|${isTeamScope ? 'team' : 'self'}`;

        if (capacityCache?.has(cacheKey)) {
            return capacityCache.get(cacheKey)!;
        }

        let result: number;

        if (isTeamScope) {
            result = this.calculateTeamCapacityForDate(date, context);
            capacityCache?.set(cacheKey, result);
            return result;
        }

        const isHol = this.checkIsHoliday(date, context);
        const dayOfWeek = date.getDay();

        // --- Core Allocation Logic (Company Specific Priority) ---
        // Priority 1: Specific Context (フィルタで絞り込まれている、または特定の会社枠を表示したい場合)
        if (targetId) {
            const companyException = capacityConfig.dailyCompanyExceptions?.[dateKey];
            if (companyException && companyException[targetId] !== undefined) {
                result = companyException[targetId];
                capacityCache?.set(cacheKey, result);
                return result;
            }

            const companyPattern = capacityConfig.defaultCompanyWeeklyPattern?.[dayOfWeek];
            if (companyPattern && companyPattern[targetId] !== undefined) {
                const val = companyPattern[targetId];

                // [Refined] If specific company capacity is defined (>0), it overrides global holiday status
                // BUT if there is a specific EXCEPTION (capacity=0) on this date, that exception wins.
                if (val > 0) {
                    const specificException = capacityConfig.dailyCompanyExceptions?.[dateKey]?.[targetId];
                    if (specificException === 0) {
                        capacityCache?.set(cacheKey, 0);
                        return 0;
                    }
                    capacityCache?.set(cacheKey, val);
                    return val;
                }
            }

            if (isHol) {
                capacityCache?.set(cacheKey, 0);
                return 0;
            }

            // No specific capacity setting for this tenant.
            // Fall back to personal standard capacity.
        }

        if (!targetId && filterMode === 'company') {
            result = this.calculateCompanyCapacityTotalForDate(date, context, capacityCache);
            capacityCache?.set(cacheKey, result);
            return result;
        }

        if (!targetId && filterMode === 'personal') {
            const total = this.calculateTotalCapacityForDate(date, context);
            const companyTotal = this.calculateCompanyCapacityTotalForDate(date, context, capacityCache);
            result = Math.max(total - companyTotal, 0);
            capacityCache?.set(cacheKey, result);
            return result;
        }

        // --- Fallback Logic: Total Standard Capacity ---
        if (isHol) {
            capacityCache?.set(cacheKey, 0);
            return 0;
        }

        result = this.calculateTotalCapacityForDate(date, context);
        capacityCache?.set(cacheKey, result);
        return result;
    }

    private static calculateTotalCapacityForDate(date: Date, context: QuantityContext): number {
        const { capacityConfig } = context;
        const dateKey = this.formatDateKey(date);
        if (capacityConfig.exceptions && capacityConfig.exceptions[dateKey] !== undefined) {
            return capacityConfig.exceptions[dateKey];
        }
        if (this.checkIsHoliday(date, context)) return 0;
        const dayOfWeek = date.getDay();
        const weeklyVal = capacityConfig.standardWeeklyPattern?.[dayOfWeek];
        return weeklyVal !== undefined ? weeklyVal : (capacityConfig.defaultDailyMinutes || 480);
    }

    private static calculateCompanyCapacityTotalForDate(date: Date, context: QuantityContext, capacityCache?: Map<string, number>): number {
        const { currentUser } = context;
        if (!currentUser) return 0;

        const tenantIds = currentUser.joinedTenants?.map(t => t.id).filter(Boolean) || [];
        if (tenantIds.length === 0) return 0;

        return tenantIds.reduce((sum, tenantId) => {
            return sum + this.calculateDefinedCompanyCapacityForDate(date, context, tenantId, capacityCache);
        }, 0);
    }

    private static calculateTeamCapacityForDate(date: Date, context: QuantityContext): number {
        if (this.checkIsHoliday(date, context)) return 0;

        const coreMembers = (context.members || []).filter(member => member.isCore);
        return coreMembers.reduce((sum, member) => {
            return sum + this.calculateMemberTeamCapacityForDate(date, member, context.teamCapacityTenantId);
        }, 0);
    }

    private static getTenantIdFromFilterMode(filterMode: FilterMode): string | null {
        if (filterMode === 'all' || filterMode === 'company' || filterMode === 'personal') return null;
        return typeof filterMode === 'string' && filterMode ? filterMode : null;
    }

    private static calculateMemberTeamCapacityForDate(date: Date, member: Member, tenantId?: string | null): number {
        const profile = member.capacityProfile;
        const dateKey = this.formatDateKey(date);
        const dayOfWeek = date.getDay();

        if (profile && tenantId) {
            const companyException = profile.dailyCompanyExceptions?.[dateKey]?.[tenantId];
            if (companyException !== undefined) return Math.max(companyException, 0);

            const companyWeekly = profile.defaultCompanyWeeklyPattern?.[dayOfWeek]?.[tenantId];
            if (companyWeekly !== undefined) return Math.max(companyWeekly, 0);
        }

        const exception = profile?.exceptions?.[dateKey];
        if (exception !== undefined) return Math.max(exception, 0);

        const weekly = profile?.standardWeeklyPattern?.[dayOfWeek];
        if (weekly !== undefined) return Math.max(weekly, 0);

        return Math.max(member.dailyCapacityMinutes || 0, 0);
    }

    private static calculateDefinedCompanyCapacityForDate(date: Date, context: QuantityContext, tenantId: string, capacityCache?: Map<string, number>): number {
        const dateKey = this.formatDateKey(date);
        const cacheKey = `${dateKey}|defined-company|${tenantId}`;
        if (capacityCache?.has(cacheKey)) return capacityCache.get(cacheKey)!;

        const { capacityConfig } = context;
        const dayOfWeek = date.getDay();
        const dailyException = capacityConfig.dailyCompanyExceptions?.[dateKey];
        if (dailyException && dailyException[tenantId] !== undefined) {
            const result = dailyException[tenantId];
            capacityCache?.set(cacheKey, result);
            return result;
        }

        const weeklyValue = capacityConfig.defaultCompanyWeeklyPattern?.[dayOfWeek]?.[tenantId];
        const result = weeklyValue !== undefined ? weeklyValue : 0;
        capacityCache?.set(cacheKey, result);
        return result;
    }

    static calculateAllocationDays(endDate: Date, estimatedMinutes: number, context: QuantityContext, tenantId?: string | null): Date[] {
        const capacityCache = new Map<string, number>();
        const { steps: details } = this.allocateBackwardsCore(endDate, estimatedMinutes, context, tenantId, capacityCache);
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

    /**
     * CORE ALLOCATION ENGINE: Single source of truth for backward distribution.
     */
    private static allocateBackwardsCore(endDate: Date, totalMinutes: number, context: QuantityContext, tenantId?: string | null, capacityCache?: Map<string, number>): { steps: AllocationStep[] } {
        const steps: AllocationStep[] = [];
        let remainingMinutes = totalMinutes || 0;
        let current = new Date(endDate);
        let safety = 0;

        while (remainingMinutes > 0 && safety < 120) { // Safety increased to 120 days
            safety++;

            // [LOGIC] Capacity calculation itself handles holiday logic priority
            const dailyCapacity = this.calculateCapacityForDate(current, context, tenantId, capacityCache);

            if (dailyCapacity <= 0) {
                current.setDate(current.getDate() - 1);
                continue;
            }

            const alloc = Math.min(remainingMinutes, dailyCapacity);
            const stepDate = new Date(current);
            stepDate.setHours(0, 0, 0, 0);

            steps.push({
                date: stepDate,
                allocatedMinutes: alloc,
                capacityMinutes: dailyCapacity
            });
            remainingMinutes -= alloc;
            current.setDate(current.getDate() - 1);
        }

        // Sort ascending (Oldest -> Newest)
        return { steps: steps.sort((a, b) => a.date.getTime() - b.date.getTime()) };
    }

    private static formatDateKey(date: Date): string {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
}
