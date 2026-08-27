/**
 * R-154: work_package段階分解の集計ロジック（docs/SPEC/08_Beaver連携Y2.md §6.3・§11）
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { formatHours, workPackageDecomposeLine, useWorkPackageSummary } from '../useBeaverIntegration';
import { BeaverLink, BeaverOverview, BeaverWorkPackage } from '@/api/beaver';

const makeWorkPackage = (overrides: Partial<BeaverWorkPackage> = {}): BeaverWorkPackage => ({
	externalWorkPackageId: 'beaver:voucher:60:line:201:factory',
	youkanItemId: 'wp1',
	label: '建具A 製作',
	category: 'factory',
	baselineMinutes: 480,
	decomposedMinutes: 420,
	effectiveTotalMinutes: 480,
	virtualResidualMinutes: 60,
	overageMinutes: 0,
	syncState: 'ok',
	...overrides,
});

const makeLink = (overrides: Partial<BeaverLink> = {}): BeaverLink => ({
	externalProjectId: 123,
	youkanProjectId: 'p1',
	name: '玄関引戸',
	sourceStatus: '製造中',
	syncState: 'ok',
	deliveryDate: '2026-09-10',
	baselineMinutes: 1200,
	baselineSource: 'estimate',
	feasibility: null,
	workPackages: [],
	...overrides,
});

describe('formatHours', () => {
	it('分単位を時間に変換し、末尾の0を落とす', () => {
		expect(formatHours(1200)).toBe('20');
		expect(formatHours(30)).toBe('0.5');
		expect(formatHours(90)).toBe('1.5');
		expect(formatHours(0)).toBe('0');
	});
});

describe('workPackageDecomposeLine', () => {
	it('work_packagesが空なら null（Y1表示は変わらない）', () => {
		expect(workPackageDecomposeLine(makeLink({ workPackages: [] }))).toBeNull();
	});

	it('未分解（baseline未満）の場合「分解済み◯h／未分解◯h」を返す', () => {
		// 案件baseline1200分(20h), work_packages合計900分(15h) → 未分解5h
		const link = makeLink({
			baselineMinutes: 1200,
			workPackages: [makeWorkPackage({ effectiveTotalMinutes: 900 })],
		});
		expect(workPackageDecomposeLine(link)).toBe('分解済み15h／未分解5h');
	});

	it('超過（baseline超）の場合「基準◯h→現在計画◯h（+◯h）」を返す', () => {
		// 案件baseline1200分(20h), work_packages合計1380分(23h) → 超過3h
		const link = makeLink({
			baselineMinutes: 1200,
			workPackages: [makeWorkPackage({ effectiveTotalMinutes: 1380 })],
		});
		expect(workPackageDecomposeLine(link)).toBe('基準20h→現在計画23h（+3h）');
	});

	it('baselineとwork_packages合計が一致する場合は超過扱いにしない', () => {
		const link = makeLink({
			baselineMinutes: 1200,
			workPackages: [makeWorkPackage({ effectiveTotalMinutes: 1200 })],
		});
		expect(workPackageDecomposeLine(link)).toBe('分解済み20h／未分解0h');
	});
});

describe('useWorkPackageSummary', () => {
	it('overviewの全リンクのwork_packagesをyoukanItemIdでMap化する', () => {
		const overview: BeaverOverview = {
			links: [
				makeLink({ workPackages: [makeWorkPackage({ youkanItemId: 'wp1' })] }),
				makeLink({ youkanProjectId: 'p2', workPackages: [makeWorkPackage({ youkanItemId: 'wp2', label: '建具B 取付' })] }),
			],
			lastSyncedAt: null,
			lastError: null,
		};

		const { result } = renderHook(() => useWorkPackageSummary(overview));

		expect(result.current.size).toBe(2);
		expect(result.current.get('wp1')?.label).toBe('建具A 製作');
		expect(result.current.get('wp2')?.label).toBe('建具B 取付');
	});

	it('overviewがnullなら空のMap', () => {
		const { result } = renderHook(() => useWorkPackageSummary(null));
		expect(result.current.size).toBe(0);
	});
});
