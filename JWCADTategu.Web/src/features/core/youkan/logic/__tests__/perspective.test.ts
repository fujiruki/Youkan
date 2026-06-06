import { describe, it, expect } from 'vitest';
import { calculatePerspective } from '../perspective';

describe('calculatePerspective', () => {
	// 仕様簡略化（R-049 棚卸し）:
	// - 個人コンテキストでは filterMode によらず「自分の時間管理 / personal_private」
	// - 会社コンテキストでは filterMode==='personal' のときのみ「社内事務」、
	//   それ以外は「事業の管理 / company_business」
	it('L-1: 個人コンテキスト・フィルタ全て -> 自分の時間管理', () => {
		const result = calculatePerspective(false, 'all');
		expect(result.perspectiveLabel).toBe('自分の時間管理');
		expect(result.perspective).toBe('personal_private');
	});

	it('L-2: 個人コンテキスト・フィルタ個人 -> 自分の時間管理', () => {
		const result = calculatePerspective(false, 'personal');
		expect(result.perspectiveLabel).toBe('自分の時間管理');
		expect(result.perspective).toBe('personal_private');
	});

	it('L-3: 個人コンテキスト・フィルタ会社でも個人時間管理に固定', () => {
		const result = calculatePerspective(false, 'company');
		expect(result.perspectiveLabel).toBe('自分の時間管理');
		expect(result.perspective).toBe('personal_private');
	});

	it('L-5: 会社コンテキスト・フィルタ全て -> 事業の管理', () => {
		const result = calculatePerspective(true, 'all');
		expect(result.perspectiveLabel).toBe('事業の管理');
		expect(result.perspective).toBe('company_business');
	});

	it('L-6: 会社コンテキスト・フィルタ個人 -> 社内事務（自分の時間管理ラベル）', () => {
		const result = calculatePerspective(true, 'personal');
		expect(result.perspectiveLabel).toBe('自分の時間管理');
		expect(result.perspective).toBe('company_internal');
	});

	it('会社コンテキスト・フィルタ company -> 事業の管理', () => {
		const result = calculatePerspective(true, 'company');
		expect(result.perspectiveLabel).toBe('事業の管理');
		expect(result.perspective).toBe('company_business');
	});
});
