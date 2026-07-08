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

    // R-049: 実装は tenantProfiles を参照しなくなっており、テスト期待と乖離。R-051 候補として保留。
    it('Scenario 2: Daily Exception Override', () => {
        // Setup: Mon=8h, company exception on 2026-02-09 = 0h (Unavailable for tenant-A)
        const profile = createProfile({ 1: 480 });
        const context = { ...baseContext };
        context.tenantProfiles = new Map([['tenant-A', profile]]);
        context.focusedTenantId = 'tenant-A';
        context.capacityConfig = {
            ...mockConfig,
            defaultCompanyWeeklyPattern: { 1: { 'tenant-A': 480 } },
            dailyCompanyExceptions: { '2026-02-09': { 'tenant-A': 0 } },
        };

        const targetDate = new Date('2026-02-09T00:00:00');
        expect(QuantityEngine.calculateCapacityForDate(targetDate, context)).toBe(0);
    });

    // R-049: tenantProfiles 廃止に伴う期待値乖離。R-051 候補として保留。
    it('Scenario 3: All Mode uses the personal total capacity without summing tenant allocations', () => {
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
        context.filterMode = 'all';
        context.capacityConfig = {
            ...mockConfig,
            standardWeeklyPattern: { 1: 480 },
            defaultCompanyWeeklyPattern: {
                1: { 'tenant-A': 360, 'tenant-B': 120 },
            },
        };

        const monday = new Date('2026-02-09T00:00:00');
        // All mode is the user's one total work pool. Summing tenant allocations would double-count time.
        expect(QuantityEngine.calculateCapacityForDate(monday, context)).toBe(480);
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

    describe('Company Capacity Allocation (New Logic)', () => {
        // R-049: joinedTenants 合算ロジック未実装。R-051 候補として保留。
    it('Scenario 6: Company Specific Weekly Pattern (A社:1h, B社:2h)', () => {
            const context: QuantityContext = {
                ...baseContext,
                filterMode: 'company',
                currentUser: {
                    id: 'test-user',
                    isCompanyAccount: false,
                    joinedTenants: [{ id: 'company-A', name: 'A' }, { id: 'company-B', name: 'B' }],
                },
                capacityConfig: {
                    ...mockConfig,
                    defaultCompanyWeeklyPattern: {
                        1: { 'company-A': 60, 'company-B': 120 } // Monday
                    }
                }
            };

            const monday = new Date('2026-02-09T00:00:00');

            // A社指定での取得
            expect(QuantityEngine.calculateCapacityForDate(monday, context, 'company-A')).toBe(60);
            // B社指定での取得
            expect(QuantityEngine.calculateCapacityForDate(monday, context, 'company-B')).toBe(120);
            // 指定なし（合計）: 既存のjoinedTenantsを参照するため、適宜設定が必要
            expect(QuantityEngine.calculateCapacityForDate(monday, context)).toBe(180); // 60 + 120
        });

        it('Scenario 7: Company Daily Exception Override', () => {
            const context: QuantityContext = {
                ...baseContext,
                capacityConfig: {
                    ...mockConfig,
                    dailyCompanyExceptions: {
                        '2026-02-09': { 'company-A': 0 } // Monday sick day for company A
                    },
                    defaultCompanyWeeklyPattern: {
                        1: { 'company-A': 480 }
                    }
                }
            };

            const targetDate = new Date('2026-02-09T00:00:00');
            expect(QuantityEngine.calculateCapacityForDate(targetDate, context, 'company-A')).toBe(0);
        });

        it('Scenario 8: Priority - Company Exception > Company Weekly > Tenant Profile', () => {
            const profileA = createProfile({ 1: 300 }); // Profile says 5h
            const context: QuantityContext = {
                ...baseContext,
                capacityConfig: {
                    ...mockConfig,
                    defaultCompanyWeeklyPattern: {
                        1: { 'company-A': 480 } // Weekly says 8h
                    }
                },
                tenantProfiles: new Map([['company-A', profileA]])
            };

            const monday = new Date('2026-02-09T00:00:00');
            // Company Weekly (480) should win over Profile (300)
            expect(QuantityEngine.calculateCapacityForDate(monday, context, 'company-A')).toBe(480);
        });

        it('filterMode ごとに総量・会社合計・個人残量を分母として返す', () => {
            const monday = new Date('2026-02-09T00:00:00');
            const context: QuantityContext = {
                ...baseContext,
                currentUser: {
                    id: 'test-user',
                    isCompanyAccount: false,
                    joinedTenants: [
                        { id: 'company-A', name: 'A' },
                        { id: 'company-B', name: 'B' },
                    ],
                },
                capacityConfig: {
                    ...mockConfig,
                    standardWeeklyPattern: { 1: 480 },
                    defaultCompanyWeeklyPattern: {
                        1: { 'company-A': 60, 'company-B': 120 },
                    },
                },
            };

            expect(QuantityEngine.calculateCapacityForDate(monday, { ...context, filterMode: 'all' })).toBe(480);
            expect(QuantityEngine.calculateCapacityForDate(monday, { ...context, filterMode: 'company' })).toBe(180);
            expect(QuantityEngine.calculateCapacityForDate(monday, { ...context, filterMode: 'personal' })).toBe(300);
            expect(QuantityEngine.calculateCapacityForDate(monday, { ...context, filterMode: 'company-A' }, 'company-A')).toBe(60);
        });

        it('日次総量例外がある日は personal 分母も総量例外から会社配分を差し引く', () => {
            const monday = new Date('2026-02-09T00:00:00');
            const context: QuantityContext = {
                ...baseContext,
                currentUser: {
                    id: 'test-user',
                    isCompanyAccount: false,
                    joinedTenants: [{ id: 'company-A', name: 'A' }],
                },
                filterMode: 'personal',
                capacityConfig: {
                    ...mockConfig,
                    exceptions: { '2026-02-09': 240 },
                    dailyCompanyExceptions: {
                        '2026-02-09': { 'company-A': 90 },
                    },
                    defaultCompanyWeeklyPattern: {
                        1: { 'company-A': 120 },
                    },
                },
            };

            expect(QuantityEngine.calculateCapacityForDate(monday, context)).toBe(150);
        });

        it('会社/チームスコープでは主力メンバーの dailyCapacityMinutes 合計を分母にする', () => {
            const monday = new Date('2026-02-09T00:00:00');
            const context: QuantityContext = {
                ...baseContext,
                useTeamCapacity: true,
                members: [
                    { id: 'm1', userId: 'u1', display_name: 'Core 1', role: 'member', isCore: true, dailyCapacityMinutes: 300 },
                    { id: 'm2', userId: 'u2', display_name: 'Core 2', role: 'member', isCore: true, dailyCapacityMinutes: 180 },
                    { id: 'm3', userId: 'u3', display_name: 'Helper', role: 'member', isCore: false, dailyCapacityMinutes: 480 },
                ],
            };

            expect(QuantityEngine.calculateCapacityForDate(monday, context)).toBe(480);
        });

        it('会社/チームスコープでも休日は分母を0にする', () => {
            const sunday = new Date('2026-02-15T00:00:00');
            const context: QuantityContext = {
                ...baseContext,
                useTeamCapacity: true,
                capacityConfig: {
                    ...mockConfig,
                    holidays: [{ type: 'weekly', value: '0' }],
                },
                members: [
                    { id: 'm1', userId: 'u1', display_name: 'Core 1', role: 'member', isCore: true, dailyCapacityMinutes: 300 },
                ],
            };

            expect(QuantityEngine.calculateCapacityForDate(sunday, context)).toBe(0);
        });

        it('会社/チームスコープではメンバー別の曜日パターンと日別例外を合算する', () => {
            const monday = new Date('2026-02-09T00:00:00');
            const tuesday = new Date('2026-02-10T00:00:00');
            const context: QuantityContext = {
                ...baseContext,
                useTeamCapacity: true,
                members: [
                    {
                        id: 'm1',
                        userId: 'u1',
                        display_name: 'Core 1',
                        role: 'member',
                        isCore: true,
                        dailyCapacityMinutes: 480,
                        capacityProfile: {
                            standardWeeklyPattern: { 1: 300, 2: 240 },
                            exceptions: { '2026-02-09': 120 },
                        },
                    },
                    {
                        id: 'm2',
                        userId: 'u2',
                        display_name: 'Core 2',
                        role: 'member',
                        isCore: true,
                        dailyCapacityMinutes: 480,
                        capacityProfile: {
                            standardWeeklyPattern: { 1: 180, 2: 180 },
                            exceptions: {},
                        },
                    },
                ],
            };

            expect(QuantityEngine.calculateCapacityForDate(monday, context)).toBe(300);
            expect(QuantityEngine.calculateCapacityForDate(tuesday, context)).toBe(420);
        });

        it('会社/チームスコープでは対象テナントの会社別配分を最優先する', () => {
            const monday = new Date('2026-02-09T00:00:00');
            const context: QuantityContext = {
                ...baseContext,
                useTeamCapacity: true,
                teamCapacityTenantId: 'company-A',
                members: [
                    {
                        id: 'm1',
                        userId: 'u1',
                        display_name: 'Core 1',
                        role: 'member',
                        isCore: true,
                        dailyCapacityMinutes: 480,
                        capacityProfile: {
                            standardWeeklyPattern: { 1: 480 },
                            exceptions: {},
                            defaultCompanyWeeklyPattern: { 1: { 'company-A': 90, 'company-B': 240 } },
                        },
                    },
                    {
                        id: 'm2',
                        userId: 'u2',
                        display_name: 'Core 2',
                        role: 'member',
                        isCore: true,
                        dailyCapacityMinutes: 480,
                        capacityProfile: {
                            standardWeeklyPattern: { 1: 480 },
                            exceptions: {},
                            defaultCompanyWeeklyPattern: { 1: { 'company-A': 120 } },
                            dailyCompanyExceptions: { '2026-02-09': { 'company-A': 0 } },
                        },
                    },
                ],
            };

            expect(QuantityEngine.calculateCapacityForDate(monday, context)).toBe(90);
        });

        it('個別テナント filterMode ではその会社の明示配分を分母にする', () => {
            const monday = new Date('2026-02-09T00:00:00');
            const context: QuantityContext = {
                ...baseContext,
                filterMode: 'company-A',
                capacityConfig: {
                    ...mockConfig,
                    standardWeeklyPattern: { 1: 480 },
                    defaultCompanyWeeklyPattern: {
                        1: { 'company-A': 90, 'company-B': 120 },
                    },
                },
            };

            expect(QuantityEngine.calculateCapacityForDate(monday, context)).toBe(90);
        });
    });
});

describe('QuantityEngine Someday除外 (R-028)', () => {
    const monday = new Date('2026-02-09T12:00:00');
    const tuesday = new Date('2026-02-10T12:00:00');
    const mondayKey = monday.toDateString(); // normalizeDateKey と同じキー形式

    const mockConfig: CapacityConfig = {
        defaultDailyMinutes: 480,
        holidays: [],
        exceptions: {}
    };

    const baseContext: QuantityContext = {
        items: [],
        members: [],
        capacityConfig: mockConfig,
        filterMode: 'all',
        currentUser: {
            id: 'test-user',
            isCompanyAccount: false,
            joinedTenants: []
        },
        tenantProfiles: new Map()
    };

    const makeItem = (id: string, status: any, prepDate?: string): any => ({
        id,
        title: `Item ${id}`,
        status,
        focusOrder: 0,
        isEngaged: false,
        statusUpdatedAt: 0,
        interrupt: false,
        weight: 1,
        createdAt: 1000,
        updatedAt: 1000,
        estimatedMinutes: 60,
        prep_date: prepDate ? Math.floor(new Date(prepDate).getTime() / 1000) : undefined
    });

    it('someday アイテムはボリューム計算に含まれない', () => {
        const somedayItem = makeItem('s1', 'someday', '2026-02-09');
        const focusItem = makeItem('f1', 'focus', '2026-02-09');

        const ctxWithSomeday: QuantityContext = {
            ...baseContext,
            items: [somedayItem, focusItem]
        };

        const metrics = QuantityEngine.calculateMetrics([monday], ctxWithSomeday);
        const metric = metrics.get(mondayKey);

        expect(metric).toBeDefined();
        // focusItem(60分) のみカウント。somedayItem は除外
        expect(metric!.volumeMinutes).toBe(60);
    });

    it('someday のみの場合、ボリュームは0', () => {
        const somedayItem = makeItem('s1', 'someday', '2026-02-09');

        const ctxOnlySomeday: QuantityContext = {
            ...baseContext,
            items: [somedayItem]
        };

        const metrics = QuantityEngine.calculateMetrics([monday], ctxOnlySomeday);
        const metric = metrics.get(mondayKey);

        expect(metric).toBeDefined();
        expect(metric!.volumeMinutes).toBe(0);
        expect(metric!.contributingItems).toHaveLength(0);
    });

    it('inbox/pending/focus は集計対象', () => {
        const items = [
            makeItem('i1', 'inbox', '2026-02-09'),
            makeItem('p1', 'pending', '2026-02-09'),
            makeItem('f1', 'focus', '2026-02-09'),
        ];

        const ctx: QuantityContext = { ...baseContext, items };
        const metrics = QuantityEngine.calculateMetrics([monday], ctx);
        const metric = metrics.get(mondayKey);

        expect(metric).toBeDefined();
        expect(metric!.volumeMinutes).toBe(180); // 3 items × 60分
    });

    it('someday アイテムは contributing items に含まれない', () => {
        const somedayItem = makeItem('s1', 'someday', '2026-02-09');
        const focusItem = makeItem('f1', 'focus', '2026-02-09');

        const ctx: QuantityContext = {
            ...baseContext,
            items: [somedayItem, focusItem]
        };

        const metrics = QuantityEngine.calculateMetrics([monday, tuesday], ctx);
        const metric = metrics.get(mondayKey);

        expect(metric).toBeDefined();
        const contributingIds = metric!.contributingItems.map(i => i.id);
        expect(contributingIds).not.toContain('s1');
        expect(contributingIds).toContain('f1');
    });
});
