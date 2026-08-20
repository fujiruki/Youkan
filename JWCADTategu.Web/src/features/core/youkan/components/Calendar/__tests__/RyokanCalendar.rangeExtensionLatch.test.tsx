import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import { RyokanCalendar, extendRangeStart, extendRangeEnd, EXTENSION_STEP_DAYS } from '../RyokanCalendar';
import { ToastProvider } from '../../../../../../contexts/ToastContext';

/**
 * R-151: スクロール範囲拡張の自己抑制
 *
 * 仕様（03_画面設計.md §5.1）:
 * 1. 上方向拡張は「拡張 → useLayoutEffect での scrollTop 補正成功」を1サイクルとするラッチ。
 *    補正が完了するまで次の拡張を発火しない。補正失敗（高さ差分 ≦ 0）なら拡張を停止する
 * 2. 拡張上限は初期 range から前後 ±24ヶ月
 * 3. displayMode 切替時は初期スクロール済みフラグをリセットし、focusDate を中央に置き直す
 */

const minimalCapacityConfig = {
	defaultDailyMinutes: 480,
	holidays: [] as string[],
	exceptions: {} as Record<string, number>
};

const baseProps = {
	items: [],
	completedItems: [],
	members: [],
	projects: [],
	capacityConfig: minimalCapacityConfig,
	joinedTenants: [],
	currentUserId: 'test-user',
	hideHeader: true
};

const cellCount = (container: HTMLElement) => container.querySelectorAll('[data-date]').length;

describe('R-151: RyokanCalendar 範囲拡張ラッチ', () => {
	beforeEach(() => {
		if (!HTMLElement.prototype.scrollIntoView) {
			(HTMLElement.prototype as any).scrollIntoView = vi.fn();
		} else {
			vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => { });
		}
		if (!(Element.prototype as any).scrollTo) {
			(Element.prototype as any).scrollTo = vi.fn();
		}
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('scrollTop<200 のスクロール連打でも拡張は1回で止まる（補正失敗＝高さ差分0で停止）', () => {
		const { container } = render(
			<RyokanCalendar {...baseProps} displayMode="grid" focusDate={new Date(2026, 5, 15)} />
		);
		const sc = container.querySelector('.scrollbar-hide') as HTMLDivElement;
		expect(sc).not.toBeNull();

		// jsdom では scrollHeight が常に一定 → prepend しても高さ差分 0 → 補正失敗
		Object.defineProperty(sc, 'scrollTop', { value: 100, writable: true, configurable: true });
		Object.defineProperty(sc, 'clientHeight', { value: 400, configurable: true });
		Object.defineProperty(sc, 'scrollHeight', { value: 1000, configurable: true });

		const before = cellCount(container);
		for (let i = 0; i < 5; i++) {
			act(() => {
				fireEvent.scroll(sc);
			});
		}
		const after = cellCount(container);

		// ラッチなしの現行実装ではスクロール5回 → 28日×5 = 140セル増える（暴走の再現）
		expect(after - before).toBeLessThanOrEqual(EXTENSION_STEP_DAYS);
	});

	it('補正成功でラッチが解除され、次のスクロールで再び拡張できる', () => {
		const { container } = render(
			<RyokanCalendar {...baseProps} displayMode="grid" focusDate={new Date(2026, 5, 15)} />
		);
		const sc = container.querySelector('.scrollbar-hide') as HTMLDivElement;

		// scrollHeight はセル数に比例（prepend で実際に高さが増える実ブラウザを模擬）
		const CELL_H = 10;
		let scrollTop = 100;
		Object.defineProperty(sc, 'scrollTop', {
			configurable: true,
			get: () => scrollTop,
			set: (v: number) => { scrollTop = v; }
		});
		Object.defineProperty(sc, 'clientHeight', { value: 400, configurable: true });
		Object.defineProperty(sc, 'scrollHeight', {
			configurable: true,
			get: () => cellCount(container) * CELL_H
		});

		const count0 = cellCount(container);
		act(() => {
			fireEvent.scroll(sc);
		});
		const count1 = cellCount(container);
		expect(count1 - count0).toBe(EXTENSION_STEP_DAYS);

		// useLayoutEffect による補正: scrollTop = 元の位置 + 追加された高さ
		expect(scrollTop).toBe(100 + EXTENSION_STEP_DAYS * CELL_H);

		// 補正成功でラッチ解除 → scrollTop を上端に戻せば次の拡張が発火する
		scrollTop = 100;
		act(() => {
			fireEvent.scroll(sc);
		});
		expect(cellCount(container) - count1).toBe(EXTENSION_STEP_DAYS);
	});

	describe('拡張上限（±24ヶ月）の純粋関数', () => {
		it('extendRangeStart は minStart で頭打ちになり、到達済みなら null を返す', () => {
			const min = new Date(2024, 7, 1);
			const start = new Date(2024, 7, 20); // min まで 19 日 < 28 日
			const extended = extendRangeStart(start, min);
			expect(extended).not.toBeNull();
			expect(extended!.getTime()).toBe(min.getTime());

			// すでに上限へ到達している場合は拡張しない
			expect(extendRangeStart(min, min)).toBeNull();
			expect(extendRangeStart(new Date(2024, 6, 1), min)).toBeNull();
		});

		it('extendRangeStart は上限まで遠ければ 28 日戻す', () => {
			const min = new Date(2024, 0, 1);
			const start = new Date(2025, 0, 1);
			const extended = extendRangeStart(start, min)!;
			const diffDays = Math.round((start.getTime() - extended.getTime()) / 86400000);
			expect(diffDays).toBe(EXTENSION_STEP_DAYS);
		});

		it('extendRangeEnd は maxEnd で頭打ちになり、到達済みなら null を返す', () => {
			const max = new Date(2028, 7, 31);
			const end = new Date(2028, 7, 20);
			const extended = extendRangeEnd(end, max);
			expect(extended).not.toBeNull();
			expect(extended!.getTime()).toBe(max.getTime());

			expect(extendRangeEnd(max, max)).toBeNull();
			expect(extendRangeEnd(new Date(2028, 9, 1), max)).toBeNull();
		});
	});

	describe('displayMode 切替時の初期スクロール再実行', () => {
		it('gantt → grid に切り替えると focusDate への初期スクロールが再実行される', () => {
			const scrollToSpy = vi.spyOn(Element.prototype as any, 'scrollTo');
			const props = { ...baseProps, focusDate: new Date(2026, 5, 15) };
			const wrap = (mode: 'grid' | 'gantt') => (
				<ToastProvider>
					<RyokanCalendar {...props} displayMode={mode} />
				</ToastProvider>
			);

			const { rerender } = render(wrap('grid'));
			rerender(wrap('gantt'));

			scrollToSpy.mockClear();
			rerender(wrap('grid'));

			// 現行実装は hasInitialScrolled が一度きりのため、切替後は scrollTop=0（拡張ゾーン）で始まる
			expect(scrollToSpy).toHaveBeenCalled();
		});
	});
});
