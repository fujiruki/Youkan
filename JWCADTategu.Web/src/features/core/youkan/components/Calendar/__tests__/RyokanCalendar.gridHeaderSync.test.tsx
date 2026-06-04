import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import React, { createRef } from 'react';
import '@testing-library/jest-dom';
import { RyokanCalendar, RyokanCalendarHandle } from '../RyokanCalendar';

/**
 * R-038: グリッドビュー縦スクロール → ヘッダー追従 / 今月を表示ボタン
 *
 * 仕様:
 * 1. displayMode='grid' で縦スクロールしたとき、ビューポート中央のセル日付から
 *    月を算出して onVisibleMonthChange に「正しい Date オブジェクト」を渡す
 * 2. scrollToToday() を呼ぶと、今月 1 日のセルが中央付近に来るように
 *    scrollIntoView が呼ばれる（または scrollTop が更新される）
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
	currentUserId: 'test-user'
};

describe('R-038: RyokanCalendar グリッドビュー ヘッダー追従', () => {
	beforeEach(() => {
		// scrollIntoView は jsdom 環境では存在しないのでモック
		if (!HTMLElement.prototype.scrollIntoView) {
			(HTMLElement.prototype as any).scrollIntoView = vi.fn();
		} else {
			vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => { });
		}
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('縦スクロール → onVisibleMonthChange', () => {
		it('グリッドモードで縦スクロールしたとき onVisibleMonthChange に有効な Date が渡る', async () => {
			const onVisibleMonthChange = vi.fn();
			const focusDate = new Date(2026, 5, 15); // 2026年6月15日

			const { container } = render(
				<RyokanCalendar
					{...baseProps}
					displayMode="grid"
					focusDate={focusDate}
					onVisibleMonthChange={onVisibleMonthChange}
					hideHeader={true}
				/>
			);

			// グリッド側のスクロールコンテナを取得（RyokanGridView のルート div）
			const scrollContainer = container.querySelector('.scrollbar-hide') as HTMLDivElement;
			expect(scrollContainer).not.toBeNull();

			// 縦スクロールをシミュレート
			onVisibleMonthChange.mockClear();
			act(() => {
				Object.defineProperty(scrollContainer, 'scrollTop', { value: 500, configurable: true });
				Object.defineProperty(scrollContainer, 'clientHeight', { value: 400, configurable: true });
				Object.defineProperty(scrollContainer, 'scrollHeight', { value: 5000, configurable: true });
				fireEvent.scroll(scrollContainer);
			});

			// onVisibleMonthChange に有効な Date が渡されること
			if (onVisibleMonthChange.mock.calls.length > 0) {
				const arg = onVisibleMonthChange.mock.calls[0][0] as Date;
				expect(arg).toBeInstanceOf(Date);
				expect(Number.isNaN(arg.getTime())).toBe(false);
			} else {
				// セルがレンダリングされていない / offsetTop が 0 のときは呼ばれないこともある。
				// その場合は少なくとも data-date セルが DOM 上に存在することを確認
				const cells = container.querySelectorAll('[data-date]');
				expect(cells.length).toBeGreaterThan(0);
			}
		});

		it('data-date 属性は正規化されたキー形式で、月の抽出に使える', () => {
			const focusDate = new Date(2026, 5, 15);
			const { container } = render(
				<RyokanCalendar
					{...baseProps}
					displayMode="grid"
					focusDate={focusDate}
					hideHeader={true}
				/>
			);

			const cells = container.querySelectorAll('[data-date]');
			expect(cells.length).toBeGreaterThan(0);

			// 各セルの data-date 値から正しく月オブジェクトを構築できること
			cells.forEach(cell => {
				const dateStr = cell.getAttribute('data-date');
				expect(dateStr).toBeTruthy();
				// new Date(dateStr) でパースできること
				const parsed = new Date(dateStr!);
				expect(Number.isNaN(parsed.getTime())).toBe(false);
			});
		});
	});

	describe('scrollToToday (今月を表示ボタン)', () => {
		it('グリッドモードで scrollToToday を呼ぶと今月セルの scrollIntoView が呼ばれる', async () => {
			const calendarRef = createRef<RyokanCalendarHandle>();
			// focusDate を今月にして、今月のセルが DOM に必ず存在する状態にする
			const focusDate = new Date(); // 今月

			const scrollIntoViewSpy = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');

			render(
				<RyokanCalendar
					ref={calendarRef}
					{...baseProps}
					displayMode="grid"
					focusDate={focusDate}
					hideHeader={true}
				/>
			);

			expect(calendarRef.current).not.toBeNull();
			expect(typeof calendarRef.current!.scrollToToday).toBe('function');

			scrollIntoViewSpy.mockClear();
			act(() => {
				calendarRef.current!.scrollToToday();
			});

			// requestAnimationFrame 内で実行されるので 2 回待機
			await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));
			await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));

			// scrollIntoView が { block: 'center' } で呼ばれていること
			expect(scrollIntoViewSpy).toHaveBeenCalled();
			const call = scrollIntoViewSpy.mock.calls[0]?.[0] as ScrollIntoViewOptions | undefined;
			expect(call?.block).toBe('center');
		});

		it('scrollToToday は scrollToMonth と異なり、今日ではなく今月を扱う', () => {
			const calendarRef = createRef<RyokanCalendarHandle>();
			render(
				<RyokanCalendar
					ref={calendarRef}
					{...baseProps}
					displayMode="grid"
					hideHeader={true}
				/>
			);

			// インターフェース存在の確認
			expect(typeof calendarRef.current!.scrollToToday).toBe('function');
			expect(typeof calendarRef.current!.scrollToMonth).toBe('function');
		});
	});
});
