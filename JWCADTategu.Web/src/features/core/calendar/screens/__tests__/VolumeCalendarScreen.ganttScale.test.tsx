import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	ganttColWidthKeyFor,
	ganttRowHeightKeyFor,
	ganttDefaultColWidth,
	ganttDefaultRowHeight,
	readGanttScaleMode,
	readStoredGanttNumber,
} from '../VolumeCalendarScreen';

/**
 * R-097: VolumeCalendarScreenのガント マンスリー/ウィークリー表示モード切替テスト
 * R-105: デイリー表示モードを追加
 *
 * ヘッダー「カレンダー→ガント」の実体はVolumeCalendarScreenであり（DashboardScreen内部の
 * viewMode==='calendar'は到達不能な死んだコードパスのため対象外）、CalendarHeaderの
 * rowHeight/onRowHeightChangeはこれまで「VolumeCalendar doesn't support rowHeight yet」として
 * ダミー値だった。R-097でスケールモード別に列幅・行高さを記憶する状態管理を追加する。
 */

describe('VolumeCalendarScreen ガントスケールモード切替（R-097, R-105）', () => {
	beforeEach(() => {
		vi.stubGlobal('localStorage', {
			store: {} as Record<string, string>,
			getItem(key: string) { return this.store[key] ?? null; },
			setItem(key: string, val: string) { this.store[key] = val; },
			removeItem(key: string) { delete this.store[key]; },
		});
	});

	it('マンスリーの列幅初期値は既存動作維持のため24px', () => {
		expect(readStoredGanttNumber(ganttColWidthKeyFor('monthly'), ganttDefaultColWidth('monthly'))).toBe(24);
	});

	it('マンスリーの行高さ初期値は既存動作維持のため28px', () => {
		expect(readStoredGanttNumber(ganttRowHeightKeyFor('monthly'), ganttDefaultRowHeight())).toBe(28);
	});

	it('ウィークリー・デイリーの列幅初期値は時間軸の分解能が見えるよう広め', () => {
		expect(ganttDefaultColWidth('weekly')).toBe(96);
		expect(ganttDefaultColWidth('daily')).toBe(96);
	});

	it('ウィークリーで列幅を50に変更後、マンスリーに切替→ウィークリーに戻ると50が復元される', () => {
		localStorage.setItem(ganttColWidthKeyFor('weekly'), '50');
		expect(readStoredGanttNumber(ganttColWidthKeyFor('monthly'), ganttDefaultColWidth('monthly'))).toBe(24);
		expect(readStoredGanttNumber(ganttColWidthKeyFor('weekly'), ganttDefaultColWidth('weekly'))).toBe(50);
	});

	it('デイリーは他モードと独立して列幅・行高さを記憶する', () => {
		localStorage.setItem(ganttColWidthKeyFor('daily'), '120');
		localStorage.setItem(ganttRowHeightKeyFor('daily'), '20');

		expect(readStoredGanttNumber(ganttColWidthKeyFor('daily'), ganttDefaultColWidth('daily'))).toBe(120);
		expect(readStoredGanttNumber(ganttRowHeightKeyFor('daily'), ganttDefaultRowHeight())).toBe(20);
		// 他モードには影響しない
		expect(readStoredGanttNumber(ganttColWidthKeyFor('weekly'), ganttDefaultColWidth('weekly'))).toBe(96);
		expect(readStoredGanttNumber(ganttColWidthKeyFor('monthly'), ganttDefaultColWidth('monthly'))).toBe(24);
	});

	it('3モードのlocalStorageキーはすべて異なる', () => {
		const keys = [
			ganttColWidthKeyFor('monthly'), ganttColWidthKeyFor('weekly'), ganttColWidthKeyFor('daily'),
			ganttRowHeightKeyFor('monthly'), ganttRowHeightKeyFor('weekly'), ganttRowHeightKeyFor('daily'),
		];
		expect(new Set(keys).size).toBe(keys.length);
	});

	it('モードごとに行高さも独立して記憶される', () => {
		localStorage.setItem(ganttRowHeightKeyFor('weekly'), '18');
		localStorage.setItem(ganttRowHeightKeyFor('monthly'), '28');
		expect(readStoredGanttNumber(ganttRowHeightKeyFor('weekly'), ganttDefaultRowHeight())).toBe(18);
		expect(readStoredGanttNumber(ganttRowHeightKeyFor('monthly'), ganttDefaultRowHeight())).toBe(28);
	});

	it('scaleModeはlocalStorageに保存された値を読み込む', () => {
		localStorage.setItem('youkan_gantt_scale_mode', 'weekly');
		expect(readGanttScaleMode()).toBe('weekly');
	});

	it('scaleModeはdailyも読み込める', () => {
		localStorage.setItem('youkan_gantt_scale_mode', 'daily');
		expect(readGanttScaleMode()).toBe('daily');
	});

	it('scaleMode未設定時のデフォルトはmonthly', () => {
		expect(readGanttScaleMode()).toBe('monthly');
	});
});
