import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import '@testing-library/jest-dom';
import { RyokanCalendar } from '../RyokanCalendar';
import { GANTT_STICKY_COL_WIDTH, calcGanttScrollLeftForIndex } from '../../../logic/ganttScroll';
import { ToastProvider } from '../../../../../../contexts/ToastContext';

/**
 * R-0168 §2.1.2: 矢印の月移動で range が張り直されるクリックでも、
 * 「張り直し（視覚位置を保つ scrollLeft 補正）→ 目標日へ smooth で1回だけスクロール」の順で動き、
 * 古い DOM（張り直し前の列位置）で算出した scrollLeft へ飛ばない。
 *
 * getBoundingClientRect は実レイアウトどおり「列の DOM 順 × 列幅 − 本体の scrollLeft」で返し、
 * scrollTo は本体の scrollLeft を実際に更新（範囲クランプ込み）するため、
 * 張り直し前後の DOM で算出結果が変わる実機の条件を jsdom で再現できる。
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
const leftFor = (index: number) => calcGanttScrollLeftForIndex(index, COL, containerWidth);

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

type ScrollCall = { from: number; left: number };

describe('R-0168 RyokanCalendar 範囲外への月移動', () => {
	let calls: ScrollCall[];

	beforeEach(() => {
		containerWidth = 1920;
		calls = [];
		(Element.prototype as any).scrollTo = function (this: HTMLElement, opts: ScrollToOptions) {
			if (typeof opts?.left !== 'number') return;
			const dayCount = this.querySelector('[data-gantt-date]')?.parentElement?.children.length ?? 0;
			const max = Math.max(0, GANTT_STICKY_COL_WIDTH + dayCount * COL - containerWidth);
			calls.push({ from: this.scrollLeft, left: opts.left });
			this.scrollLeft = Math.min(Math.max(0, opts.left), max);
		};
		vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
			const day = this.getAttribute('data-gantt-date');
			if (!day) {
				return { left: 0, right: containerWidth, top: 0, bottom: 0, width: containerWidth, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
			}
			const index = Array.prototype.indexOf.call(this.parentElement!.children, this);
			const body = this.closest('.overflow-auto') as HTMLElement | null;
			const left = GANTT_STICKY_COL_WIDTH + index * COL - (body?.scrollLeft ?? 0);
			return { left, right: left + COL, top: 0, bottom: 0, width: COL, height: 0, x: left, y: 0, toJSON: () => ({}) } as DOMRect;
		});
		vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => { cb(0); return 0; });
	});
	afterEach(() => vi.restoreAllMocks());

	const mount = () => {
		const ref = React.createRef<{ go: (d: Date) => void }>();
		const container: React.MutableRefObject<HTMLElement | null> = { current: null };
		render(<Harness ref={ref} container={container} />);
		const body = () => container.current!.querySelector('.overflow-auto') as HTMLElement;
		const firstDay = () => container.current!.querySelector('[data-gantt-date]')!.getAttribute('data-gantt-date');
		return {
			go: (d: Date) => { calls = []; act(() => { ref.current!.go(d); }); },
			body,
			firstDay,
		};
	};

	it('初期表示は今日（focusDate）を中央に置く', () => {
		const { body, firstDay } = mount();
		expect(firstDay()).toBe(new Date(2026, 5, 28).toDateString());
		expect(body().scrollLeft).toBe(leftFor(89));
	});

	it('次月×4: 張り直し回も「視覚位置を保った補正 → 目標15日へ1回の scrollTo」で着地する', () => {
		const { go, body, firstDay } = mount();

		go(new Date(2026, 9, 1));
		expect(calls).toEqual([{ from: leftFor(89), left: leftFor(109) }]);

		go(new Date(2026, 10, 1));
		expect(firstDay()).toBe(new Date(2026, 7, 30).toDateString());
		expect(calls).toEqual([{ from: leftFor(46), left: leftFor(77) }]);
		expect(body().scrollLeft).toBe(leftFor(77));

		go(new Date(2026, 11, 1));
		expect(firstDay()).toBe(new Date(2026, 7, 30).toDateString());
		expect(calls).toEqual([{ from: leftFor(77), left: leftFor(107) }]);

		go(new Date(2027, 0, 1));
		expect(firstDay()).toBe(new Date(2026, 10, 1).toDateString());
		expect(calls).toEqual([{ from: leftFor(44), left: leftFor(75) }]);
		expect(body().scrollLeft).toBe(leftFor(75));
	});

	it('前月×2: 張り直し回は左端に張り付かず、補正後に目標15日へ後ろ向きに1回動く', () => {
		const { go, body, firstDay } = mount();

		go(new Date(2026, 7, 1));
		expect(calls).toEqual([{ from: leftFor(89), left: leftFor(48) }]);

		go(new Date(2026, 6, 1));
		expect(firstDay()).toBe(new Date(2026, 3, 26).toDateString());
		expect(calls).toEqual([{ from: leftFor(111), left: leftFor(80) }]);
		expect(body().scrollLeft).toBe(leftFor(80));
	});

	it('focusDate が範囲外へ出る移動でも、目標月の15日へ1回だけスクロールし focusDate の日へは行かない', () => {
		const { go, body, firstDay } = mount();

		go(new Date(2026, 11, 25));

		expect(firstDay()).toBe(new Date(2026, 8, 27).toDateString());
		expect(calls.map(c => c.left)).toEqual([leftFor(79)]);
		expect(body().scrollLeft).toBe(leftFor(79));
	});

	it('可視領域が範囲全体より広く、どこにも中央に置けないときは張り直しを繰り返さず端に寄せて確定する', () => {
		containerWidth = 6000;
		const { go, firstDay } = mount();

		go(new Date(2026, 9, 1));

		expect(firstDay()).toBe(new Date(2026, 6, 26).toDateString());
		expect(calls.map(c => c.left)).toEqual([0]);
	});
});
