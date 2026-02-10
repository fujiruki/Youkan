import { describe, it, expect } from 'vitest';
import { QuantityEngine, QuantityContext } from './QuantityEngine';
import { CapacityConfig, FilterMode, WeeklyPattern, CapacityProfile } from '../types';

describe('QuantityEngine.calculateCapacityForDate', () => {

    // Mock Data Helpers
    const mockConfig: CapacityConfig = {
        defaultDailyMinutes: 480, // 8h
        holidays: [],
        exceptions: {}
    };

    const createProfile = (pattern: WeeklyPattern, exceptions: Record<string, number> = {}): CapacityProfile => ({
        standardWeeklyPattern: pattern,
        exceptions
    });

    const baseContext: QuantityContext = {
        items: [],
        members: [],
        capacityConfig: mockConfig,
        filterMode: 'all',
        currentUser: {
            id: 'test-user',
            isCompanyAccount: false,
            joinedTenants: [{ id: 'tenant-A', name: 'Tenant A' }]
        },
        // Populate below for specific tests
        tenantProfiles: new Map()
    };

    it('Scenario 1: Basic Weekly Pattern (Mon=480, Sun=0)', () => {
        // Setup: Mon=8h, Sun=0h
        const profile = createProfile({ 1: 480, 0: 0 });
        const context = { ...baseContext };
        context.tenantProfiles = new Map([['tenant-A', profile]]);
        context.focusedTenantId = 'tenant-A'; // Focus on A

        // Test Monday (2026-02-09)
        const monday = new Date('2026-02-09T00:00:00');
        expect(QuantityEngine.calculateCapacityForDate(monday, context)).toBe(480);

        // Test Sunday (2026-02-15)
        const sunday = new Date('2026-02-15T00:00:00');
        expect(QuantityEngine.calculateCapacityForDate(sunday, context)).toBe(0);
    });

    it('Scenario 2: Daily Exception Override', () => {
        // Setup: Mon=8h, Exception on 2026-02-09 = 0h (Sick day)
        const profile = createProfile({ 1: 480 }, { '2026-02-09': 0 });
        const context = { ...baseContext };
        context.tenantProfiles = new Map([['tenant-A', profile]]);
        context.focusedTenantId = 'tenant-A';

        const targetDate = new Date('2026-02-09T00:00:00');
        expect(QuantityEngine.calculateCapacityForDate(targetDate, context)).toBe(0);
    });

    it('Scenario 3: Multi-Tenant Aggregation (All Mode)', () => {
        // Setup: Tenant A (Mon=8h), Tenant B (Mon=2h)
        const profileA = createProfile({ 1: 480 });
        const profileB = createProfile({ 1: 120 });

        const context = { ...baseContext };
        context.currentUser!.joinedTenants = [
            { id: 'tenant-A', name: 'A' },
            { id: 'tenant-B', name: 'B' }
        ];
        context.tenantProfiles = new Map([
            ['tenant-A', profileA],
            ['tenant-B', profileB]
        ]);
        context.filterMode = 'all'; // Summation

        const monday = new Date('2026-02-09T00:00:00');
        expect(QuantityEngine.calculateCapacityForDate(monday, context)).toBe(600); // 480 + 120
    });

    it('Scenario 4: Single Tenant Focus', () => {
        // Setup: Tenant A (Mon=8h), Tenant B (Mon=2h)
        // Focus on A -> Expect 480
        const profileA = createProfile({ 1: 480 });
        const profileB = createProfile({ 1: 120 });

        const context = { ...baseContext };
        context.tenantProfiles = new Map([
            ['tenant-A', profileA],
            ['tenant-B', profileB]
        ]);
        context.filterMode = 'company';
        context.focusedTenantId = 'tenant-A';

        const monday = new Date('2026-02-09T00:00:00');
        expect(QuantityEngine.calculateCapacityForDate(monday, context)).toBe(480);
    });

    it('Scenario 5: Fallback to Default Config', () => {
        // Setup: No profile for tenant -> Use system default (480)
        const context = { ...baseContext };
        context.tenantProfiles = new Map(); // Empty
        context.focusedTenantId = 'tenant-A';

        const monday = new Date('2026-02-09T00:00:00');
        // fallback to capacityConfig.defaultDailyMinutes = 480
        expect(QuantityEngine.calculateCapacityForDate(monday, context)).toBe(480);
    });
});
