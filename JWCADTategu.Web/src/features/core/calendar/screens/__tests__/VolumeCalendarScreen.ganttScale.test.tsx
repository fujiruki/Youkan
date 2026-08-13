import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * R-097: VolumeCalendarScreenのガント マンスリー/ウィークリー表示モード切替テスト
 *
 * ヘッダー「カレンダー→ガント」の実体はVolumeCalendarScreenであり（DashboardScreen内部の
 * viewMode==='calendar'は到達不能な死んだコードパスのため対象外）、CalendarHeaderの
 * rowHeight/onRowHeightChangeはこれまで「VolumeCalendar doesn't support rowHeight yet」として
 * ダミー値だった。R-097でスケールモード別に列幅・行高さを記憶する状態管理を追加する。
 *
 * VolumeCalendarScreen.showGroups.test.tsx と同じ「ロジック抽出」方式で、
 * localStorageキーの読み書き・モード切替時の値復元ロジックを検証する。
 */

const KEYS = {
	SCALE_MODE: 'youkan_gantt_scale_mode',
	COL_WIDTH_MONTHLY: 'youkan_gantt_col_width_monthly',
	ROW_HEIGHT_MONTHLY: 'youkan_gantt_row_height_monthly',
	COL_WIDTH_WEEKLY: 'youkan_gantt_col_width_weekly',
	ROW_HEIGHT_WEEKLY: 'youkan_gantt_row_height_weekly',
};

const colWidthKeyFor = (mode: 'monthly' | 'weekly') =>
	mode === 'weekly' ? KEYS.COL_WIDTH_WEEKLY : KEYS.COL_WIDTH_MONTHLY;
const rowHeightKeyFor = (mode: 'monthly' | 'weekly') =>
	mode === 'weekly' ? KEYS.ROW_HEIGHT_WEEKLY : KEYS.ROW_HEIGHT_MONTHLY;
const readStoredNumber = (key: string, fallback: number) => {
	const saved = localStorage.getItem(key);
	const n = saved ? parseInt(saved, 10) : NaN;
	return Number.isFinite(n) ? n : fallback;
};

describe('VolumeCalendarScreen ガントスケールモード切替（R-097）', () => {
	beforeEach(() => {
		vi.stubGlobal('localStorage', {
			store: {} as Record<string, string>,
			getItem(key: string) { return this.store[key] ?? null; },
			setItem(key: string, val: string) { this.store[key] = val; },
			removeItem(key: string) { delete this.store[key]; },
		});
	});

	it('マンスリーの列幅初期値は既存動作維持のため24px', () => {
		expect(readStoredNumber(colWidthKeyFor('monthly'), 24)).toBe(24);
	});

	it('マンスリーの行高さ初期値は既存動作維持のため28px', () => {
		expect(readStoredNumber(rowHeightKeyFor('monthly'), 28)).toBe(28);
	});

	it('ウィークリーで列幅を50に変更後、マンスリーに切替→ウィークリーに戻ると50が復元される', () => {
		// ウィークリーで調整
		localStorage.setItem(colWidthKeyFor('weekly'), '50');
		// マンスリーに切替（マンスリー側の記憶値を読む。未設定なら既定24）
		const monthlyColWidth = readStoredNumber(colWidthKeyFor('monthly'), 24);
		expect(monthlyColWidth).toBe(24);
		// 再度ウィークリーに戻る
		const weeklyColWidth = readStoredNumber(colWidthKeyFor('weekly'), 24);
		expect(weeklyColWidth).toBe(50);
	});

	it('モードごとに行高さも独立して記憶される', () => {
		localStorage.setItem(rowHeightKeyFor('weekly'), '18');
		localStorage.setItem(rowHeightKeyFor('monthly'), '28');
		expect(readStoredNumber(rowHeightKeyFor('weekly'), 28)).toBe(18);
		expect(readStoredNumber(rowHeightKeyFor('monthly'), 28)).toBe(28);
	});

	it('scaleModeはlocalStorageに保存された値を読み込む', () => {
		localStorage.setItem(KEYS.SCALE_MODE, 'weekly');
		const saved = localStorage.getItem(KEYS.SCALE_MODE);
		const mode = saved === 'weekly' ? 'weekly' : 'monthly';
		expect(mode).toBe('weekly');
	});

	it('scaleMode未設定時のデフォルトはmonthly', () => {
		const saved = localStorage.getItem(KEYS.SCALE_MODE);
		const mode = saved === 'weekly' ? 'weekly' : 'monthly';
		expect(mode).toBe('monthly');
	});
});
