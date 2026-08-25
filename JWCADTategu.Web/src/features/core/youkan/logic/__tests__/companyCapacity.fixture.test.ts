import { describe, it, expect } from 'vitest';
import { Member, CapacityConfig, CapacityProfile } from '../../types';
import { QuantityEngine, QuantityContext } from '../QuantityEngine';
import fixture from '../../../../../../../backend/tests/fixtures/company_capacity_cases.json';

/**
 * R-153 (h): 会社日次キャパ（memberships.is_core=1 の合計）の TS/PHP 同一性担保。
 * backend/tests/fixtures/company_capacity_cases.json を
 * PHP側 test_r153_company_capacity_fixture.php（BeaverCapacityService::calcCompanyDailyCapacity）と共有し、
 * 同じ入力で同じキャパ分数になることを確認する。定義を変えるときはフィクスチャを先に変える。
 */
interface FixtureMember {
    userId: string;
    isCore: boolean;
    dailyCapacityMinutes: number;
    capacityProfile: CapacityProfile | null;
}

const toMember = (m: FixtureMember): Member => ({
    id: m.userId,
    userId: m.userId,
    display_name: m.userId,
    role: 'member',
    isCore: m.isCore,
    dailyCapacityMinutes: m.dailyCapacityMinutes,
    capacityProfile: m.capacityProfile ?? undefined,
});

describe('会社日次キャパ 共有フィクスチャ (R-153)', () => {
    const context: QuantityContext = {
        items: [],
        members: (fixture.members as unknown as FixtureMember[]).map(toMember),
        capacityConfig: fixture.capacity_config as unknown as CapacityConfig,
        useTeamCapacity: true,
        teamCapacityTenantId: fixture.tenant_id,
        currentUser: { id: 'u_1', isCompanyAccount: false, joinedTenants: [] },
    };

    for (const c of fixture.cases) {
        it(c.name, () => {
            const date = new Date(`${c.date}T00:00:00`);
            const metrics = QuantityEngine.calculateMetrics([date], context);
            const metric = [...metrics.values()][0];
            expect(metric.capacityMinutes).toBe(c.expected_minutes);
        });
    }
});
