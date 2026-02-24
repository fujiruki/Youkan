import { describe, it, expect } from 'vitest';
import { calculatePerspective } from '../perspective';
import { JoinedTenant } from '../../types';

describe('calculatePerspective', () => {
	const mockTenants: JoinedTenant[] = [
		{ id: 'tenant-a', name: 'A社', title: 'A社', role: 'admin' },
		{ id: 'tenant-b', name: 'B社', title: 'B社', role: 'member' },
	];

	it('L-1: 個人アカウント・フィルタ全て -> 自分の時間管理', () => {
		const result = calculatePerspective(false, 'all', mockTenants);
		expect(result.perspectiveLabel).toBe('自分の時間管理');
		expect(result.perspective).toBe('personal_private');
	});

	it('L-2: 個人アカウント・フィルタ個人 -> 自分の時間管理', () => {
		const result = calculatePerspective(false, 'personal', mockTenants);
		expect(result.perspectiveLabel).toBe('自分の時間管理');
		expect(result.perspective).toBe('personal_private');
	});

	it('L-3: 個人アカウント・フィルタ会社 -> 会社業務の俯瞰', () => {
		const result = calculatePerspective(false, 'company', mockTenants);
		expect(result.perspectiveLabel).toBe('会社業務の俯瞰');
		expect(result.perspective).toBe('personal_company');
	});

	it('L-4: 個人アカウント・特定テナント選択 -> マネージャーラベル', () => {
		const result = calculatePerspective(false, 'tenant-a', mockTenants);
		expect(result.perspectiveLabel).toBe('A社マネージャーとして');
		expect(result.perspective).toBe('personal_company');
	});

	it('L-5: 会社アカウント・フィルタ全て -> 事業の管理', () => {
		const result = calculatePerspective(true, 'all', mockTenants);
		expect(result.perspectiveLabel).toBe('事業の管理');
		expect(result.perspective).toBe('company_business');
	});

	it('L-6: 会社アカウント・フィルタ個人 -> 社内業務の管理', () => {
		const result = calculatePerspective(true, 'personal', mockTenants);
		expect(result.perspectiveLabel).toBe('社内業務の管理');
		expect(result.perspective).toBe('company_internal');
	});

	it('会社アカウント・特定テナント選択 -> 特定組織の管理', () => {
		const result = calculatePerspective(true, 'tenant-b', mockTenants);
		expect(result.perspectiveLabel).toBe('B社の管理');
		expect(result.perspective).toBe('company_business');
	});
});
