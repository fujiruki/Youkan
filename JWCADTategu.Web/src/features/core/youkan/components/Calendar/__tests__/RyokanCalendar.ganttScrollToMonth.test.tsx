import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import { RyokanCalendar } from '../RyokanCalendar';
import { ToastProvider } from '../../../../../../contexts/ToastContext';

/**
 * R-0168-A/D: ガントの scrollToMonth / scrollToToday は、初期表示範囲（±2ヶ月）の外でも
 * 範囲拡張後の DOM に対して実際にスクロールする
 */

const baseProps = {
	items: [],
	completedItems: [],
	members: [],
	projects: [],
	capacityConfig: { defaultDailyMinutes: 480, holidays: [] as string[], exceptions: {} as Record<string, number> },
	joinedTenants: [],
	currentUserId: 'test-user',
	hideHeader: true
};

describe('R-0168 RyokanCalendar ガント範囲外スクロール', () => {
	let scrollToSpy: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		if (!(Element.prototype as any).scrollTo) (Element.prototype as any).scrollTo = vi.fn();
		scrollToSpy = vi.spyOn(Element.prototype as any, 'scrollTo').mockImplementation(() => { }) as any;
		vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
			const isDay = this.hasAttribute('data-gantt-date');
			return { left: isDay ? 3000 : 0, right: isDay ? 3024 : 0, top: 0, bottom: 0, width: isDay ? 24 : 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
		});
		vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => { cb(0); return 0; });
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	const mountGantt = (focus: Date) => {
		const ref = React.createRef<any>();
		const utils = render(<ToastProvider><RyokanCalendar {...baseProps} ref={ref} displayMode="gantt" focusDate={focus} /></ToastProvider>);
		return { ref, ...utils };
	};

	const hasDay = (container: HTMLElement, d: Date) =>
		!!container.querySelector(`[data-gantt-date="${d.toDateString()}"]`);

	it('範囲外の月へ scrollToMonth すると、その月の列が描画された状態で left>0 の scrollTo が呼ばれる', () => {
		const { ref, container } = mountGantt(new Date(2026, 5, 15));
		expect(hasDay(container, new Date(2026, 11, 15))).toBe(false);
		scrollToSpy.mockClear();

		act(() => { ref.current.scrollToMonth(2026, 11); });

		expect(hasDay(container, new Date(2026, 11, 15))).toBe(true);
		expect(scrollToSpy.mock.calls.some(c => (c[0] as any)?.left > 0)).toBe(true);
	});

	it('範囲外の今日へ scrollToToday しても、今日の列が描画されスクロールが実行される', () => {
		const now = new Date();
		const far = new Date(now.getFullYear(), now.getMonth() + 6, 15);
		const { ref, container } = mountGantt(far);
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		expect(hasDay(container, today)).toBe(false);
		scrollToSpy.mockClear();

		act(() => { ref.current.scrollToToday(); });

		expect(hasDay(container, today)).toBe(true);
		expect(scrollToSpy.mock.calls.some(c => (c[0] as any)?.left > 0)).toBe(true);
	});
});
