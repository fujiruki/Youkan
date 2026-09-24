import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import '@testing-library/jest-dom';
import { RyokanCalendar } from '../RyokanCalendar';
import { GANTT_STICKY_COL_WIDTH } from '../../../logic/ganttScroll';
import { ToastProvider } from '../../../../../../contexts/ToastContext';

/**
 * R-0168: 矢印で focusDate が表示範囲（±2ヶ月）の外へ出て range が張り直されたとき、
 * 初期スクロールは focusDate（例: 25日）ではなく矢印の目標日（月中央15日）へ行う。
 * 3クリック目だけ「25日へ瞬間移動 → 15日へ戻る」というジャンプを出さない。
 *
 * §2.1 追加: 目標日が範囲の端に近く中央に置けない（scrollLeft がクランプされる）ときは、
 * スクロール前に目標月を中心に range を張り直してから15日へ着地する。
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

let containerWidth = 1920;
const COL = 24;
const ORIGIN = new Date(2026, 0, 1).getTime();
const rectLeftOf = (dateStr: string) => Math.round((new Date(dateStr).getTime() - ORIGIN) / 86400000) * COL;
/** scrollToDateElement が算出する scrollLeft（container.scrollLeft=0、containerRect.left=0 前提） */
const expectedLeft = (d: Date) =>
	rectLeftOf(d.toDateString()) - (GANTT_STICKY_COL_WIDTH + (containerWidth - GANTT_STICKY_COL_WIDTH) / 2) + COL / 2;

/** VolumeCalendarScreen と同じ順序（focusDate 更新 → コミット後の effect で scrollToMonth）を再現する */
const Harness = forwardRef<{ go: (d: Date) => void }, { container: React.MutableRefObject<HTMLElement | null> }>(({ container }, ref) => {
	const calRef = useRef<any>(null);
	const [focus, setFocus] = useState(new Date(2026, 8, 25));
	const navRef = useRef<Date | null>(null);
	useImperativeHandle(ref, () => ({
		go: (d: Date) => { navRef.current = d; setFocus(d); }
	}));
	useEffect(() => {
		const d = navRef.current;
		if (!d) return;
		navRef.current = null;
		calRef.current?.scrollToMonth(d.getFullYear(), d.getMonth());
	}, [focus]);
	return (
		<ToastProvider>
			<div ref={el => { container.current = el; }}>
				<RyokanCalendar {...baseProps} ref={calRef} displayMode="gantt" focusDate={focus} />
			</div>
		</ToastProvider>
	);
});

describe('R-0168 RyokanCalendar 範囲外への月移動', () => {
	let scrollToSpy: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		containerWidth = 1920;
		if (!(Element.prototype as any).scrollTo) (Element.prototype as any).scrollTo = vi.fn();
		scrollToSpy = vi.spyOn(Element.prototype as any, 'scrollTo').mockImplementation(() => { }) as any;
		vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
			const day = this.getAttribute('data-gantt-date');
			const left = day ? rectLeftOf(day) : 0;
			const width = day ? COL : containerWidth;
			return { left, right: left + width, top: 0, bottom: 0, width, height: 0, x: left, y: 0, toJSON: () => ({}) } as DOMRect;
		});
		vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => { cb(0); return 0; });
	});
	afterEach(() => vi.restoreAllMocks());

	const mount = () => {
		const ref = React.createRef<{ go: (d: Date) => void }>();
		const container: React.MutableRefObject<HTMLElement | null> = { current: null };
		render(<Harness ref={ref} container={container} />);
		const hasDay = (d: Date) => !!container.current?.querySelector(`[data-gantt-date="${d.toDateString()}"]`);
		const lefts = () => scrollToSpy.mock.calls.map(c => (c[0] as any)?.left).filter((l): l is number => typeof l === 'number');
		return { go: (d: Date) => act(() => { ref.current!.go(d); }), hasDay, lefts };
	};

	it('range 張り直しを伴う次月移動では、目標月の15日へだけスクロールし focusDate の日へは行かない', () => {
		const { go, lefts } = mount();
		scrollToSpy.mockClear();

		go(new Date(2026, 11, 25));

		expect(lefts().length).toBeGreaterThan(0);
		expect(lefts()).not.toContain(expectedLeft(new Date(2026, 11, 25)));
		expect(lefts().every(l => l === expectedLeft(new Date(2026, 11, 15)))).toBe(true);
	});

	it('目標月の15日が範囲の端に近く中央に置けないときは、range を目標月中心に張り直してから15日へ着地する', () => {
		const { go, hasDay, lefts } = mount();
		go(new Date(2026, 9, 1));
		expect(hasDay(new Date(2027, 0, 15))).toBe(false);
		scrollToSpy.mockClear();

		go(new Date(2026, 10, 1));

		expect(hasDay(new Date(2027, 0, 15))).toBe(true);
		expect(lefts().length).toBeGreaterThan(0);
		expect(lefts().every(l => l === expectedLeft(new Date(2026, 10, 15)))).toBe(true);
	});

	it('可視領域が範囲全体より広く、どこにも中央に置けないときは張り直しを繰り返さず端に寄せて確定する', () => {
		containerWidth = 6000;
		const { go, hasDay, lefts } = mount();
		scrollToSpy.mockClear();

		go(new Date(2026, 9, 1));

		expect(hasDay(new Date(2026, 11, 15))).toBe(true);
		expect(hasDay(new Date(2026, 7, 1))).toBe(true);
		expect(lefts()).toContain(expectedLeft(new Date(2026, 9, 15)));
	});
});
