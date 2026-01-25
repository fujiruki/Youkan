import { Member, CapacityConfig } from '../../jbwos/types';
import { isHoliday } from '../../jbwos/logic/capacity';

export type CapacityProvider = (date: Date) => number;

export const createCapacityProvider = (members: Member[], config: CapacityConfig): CapacityProvider => {
    // 1. Calculate Total Core Capacity
    const totalCoreCapacity = members
        .filter(m => Boolean(m.isCore))
        .reduce((sum, m) => sum + (m.dailyCapacityMinutes || 480), 0);

    return (date: Date) => {
        // 2. Check Holiday
        if (isHoliday(date, config)) {
            return 0;
        }

        // 3. Return Team Capacity (Fallback to default if 0 but not holiday)
        // If totalCoreCapacity is 0 (no members), usually we imply 1 full person (480) for simulation?
        // Or strictly 0?
        // The test expects 480 fallback if empty members.
        return totalCoreCapacity > 0 ? totalCoreCapacity : config.defaultDailyMinutes || 480;
    };
};
