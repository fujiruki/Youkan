import { describe, it, expect } from 'vitest';
import { createCapacityProvider } from './CapacityFactory';
import { Member, CapacityConfig } from '../../jbwos/types';
import { parseISO } from 'date-fns';

describe('CapacityFactory', () => {
    const mockMember = (id: string, isCore: boolean, capacity: number): Member => ({
        id,
        userId: id,
        username: `User ${id}`,
        role: 'user',
        isCore,
        dailyCapacityMinutes: capacity
    });

    const mockConfig: CapacityConfig = {
        defaultDailyMinutes: 480,
        holidays: [
            { type: 'weekly', value: '0', label: 'Sunday' } // Sunday is holiday (String '0')
        ],
        exceptions: {}
    };

    it('should sum daily capacity of all CORE members', () => {
        const members = [
            mockMember('1', true, 240),  // Core
            mockMember('2', true, 240),  // Core
            mockMember('3', false, 480)  // Non-Core (Should be ignored)
        ];

        const getCapacity = createCapacityProvider(members, mockConfig);

        // Monday (Not Holiday)
        const date = parseISO('2026-02-02'); // Monday
        const cap = getCapacity(date);

        expect(cap).toBe(480); // 240 + 240
    });

    it('should return 0 on Holidays', () => {
        const members = [mockMember('1', true, 480)];
        const getCapacity = createCapacityProvider(members, mockConfig);

        // Sunday (Holiday)
        const date = parseISO('2026-02-01'); // Sunday
        const cap = getCapacity(date);

        expect(cap).toBe(0);
    });

    it('should respect Exception Holidays', () => {
        const members = [mockMember('1', true, 480)];
        const configWithException: CapacityConfig = {
            ...mockConfig,
            exceptions: { '2026-02-03': 0 } // Tuesday is holiday
        };
        const getCapacity = createCapacityProvider(members, configWithException);

        const cap = getCapacity(parseISO('2026-02-03'));
        expect(cap).toBe(0);
    });

    it('should return default fallback if total capacity is 0 (to avoid infinite loops)', () => {
        // Usually we fallback to something strictly positive IF we are not on a holiday?
        // Or does the logic return 0 and AllocationCalculator handles it?
        // Requirement: If working day but no members, we usually assume 1 person (MVP behavior).

        const members: Member[] = []; // No members
        const getCapacity = createCapacityProvider(members, mockConfig);

        const date = parseISO('2026-02-02'); // Monday
        const cap = getCapacity(date);

        expect(cap).toBe(480); // Default fallback
    });
});
