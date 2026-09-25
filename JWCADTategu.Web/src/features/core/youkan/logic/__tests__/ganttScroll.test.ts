import { describe, it, expect } from 'vitest';
import { GANTT_STICKY_COL_WIDTH, calcGanttCenterDayIndex, calcGanttScrollLeftForIndex, canCenterGanttIndex, calcGanttRebasedScrollLeft } from '../ganttScroll';

/**
 * R-0168 §2.1.2: range 張り直しで allDays の先頭が N 日ずれたとき、同じ日付が同じ画面位置に残る scrollLeft。
 * 実測値（列幅24・viewport1920）: Jun28始点で 10/15（index109）中央 → Aug30始点（+63日）では index46
 */
describe('R-0168 calcGanttRebasedScrollLeft（張り直し時の視覚位置アンカー）', () => {
	const colWidth = 24;
	const clientWidth = 1920;
	const day = (y: number, m: number, d: number) => new Date(y, m, d).getTime();

	it('次月方向: Jun28→Aug30（+63日）の張り直しで 10/15 中央の位置が保たれ、目標 11/15 へは前向きに動く', () => {
		const before = calcGanttScrollLeftForIndex(109, colWidth, clientWidth);
		const rebased = calcGanttRebasedScrollLeft(before, day(2026, 5, 28), day(2026, 7, 30), colWidth);
		expect(rebased).toBe(calcGanttScrollLeftForIndex(46, colWidth, clientWidth));
		const target = calcGanttScrollLeftForIndex(77, colWidth, clientWidth);
		expect(target).toBeGreaterThan(rebased);
		expect(canCenterGanttIndex(77, 161, colWidth, clientWidth)).toBe(true);
	});

	it('前月方向: Jun28→Apr26（−63日）の張り直しで 8/15 中央の位置が保たれ、目標 7/15 へは後ろ向きに動く', () => {
		const before = calcGanttScrollLeftForIndex(48, colWidth, clientWidth);
		const rebased = calcGanttRebasedScrollLeft(before, day(2026, 5, 28), day(2026, 3, 26), colWidth);
		expect(rebased).toBe(calcGanttScrollLeftForIndex(111, colWidth, clientWidth));
		const target = calcGanttScrollLeftForIndex(80, colWidth, clientWidth);
		expect(target).toBeLessThan(rebased);
		expect(canCenterGanttIndex(80, 161, colWidth, clientWidth)).toBe(true);
	});

	it('先頭が変わらなければ scrollLeft も変わらない（夏時間の1時間差は日数に丸める）', () => {
		expect(calcGanttRebasedScrollLeft(1000, day(2026, 5, 28), day(2026, 5, 28), colWidth)).toBe(1000);
		expect(calcGanttRebasedScrollLeft(1000, day(2026, 2, 1), day(2026, 3, 1), colWidth)).toBe(1000 - 31 * colWidth);
	});
});

/**
 * R-0168 §2.1 追加: 表示範囲（allDays）の端に近い日は、固定列を除いた可視領域の中央に置くと
 * scrollLeft が 0 / 最大でクランプされて届かない。中央に置けるかを事前に判定する
 */
describe('R-0168 canCenterGanttIndex（実測: 列幅24・161日・viewport 1920）', () => {
	const colWidth = 24;
	const dayCount = 161;
	const clientWidth = 1920;

	it('10/15（index 109）は中央に置ける', () => {
		expect(canCenterGanttIndex(109, dayCount, colWidth, clientWidth)).toBe(true);
	});

	it('11/15（index 140）は右端まで35日分の余白が無く、中央に置けない', () => {
		expect(canCenterGanttIndex(140, dayCount, colWidth, clientWidth)).toBe(false);
	});

	it('8/15（index 48）は中央に置けるが 7/15（index 17）は左端の余白が無く置けない', () => {
		expect(canCenterGanttIndex(48, dayCount, colWidth, clientWidth)).toBe(true);
		expect(canCenterGanttIndex(17, dayCount, colWidth, clientWidth)).toBe(false);
	});

	it('可視領域が範囲全体より広いときは、どの index も中央に置けない', () => {
		expect(canCenterGanttIndex(80, dayCount, 16, 4000)).toBe(false);
	});
});

/**
 * R-0168-B: ガントの中央日算出は左固定列256pxを除いた可視領域の中央で行う
 */
describe('R-0168-B ガント中央日・スクロール位置算出', () => {
	it('固定列幅は256px', () => {
		expect(GANTT_STICKY_COL_WIDTH).toBe(256);
	});

	it.each([16, 24])('colWidth=%dでスクロール位置から算出した中央日が、そのindexを中央に置くスクロール位置と往復一致する', (colWidth) => {
		const clientWidth = 1200;
		for (const index of [45, 100, 149]) {
			const left = calcGanttScrollLeftForIndex(index, colWidth, clientWidth);
			expect(calcGanttCenterDayIndex(left, clientWidth, colWidth)).toBe(index);
		}
	});

	it('固定列を考慮しない旧算出（scrollLeft + clientWidth/2）とは可視領域中央分だけ異なる', () => {
		const colWidth = 24;
		const clientWidth = 1200;
		const scrollLeft = 2400;
		const old = Math.floor((scrollLeft + clientWidth / 2) / colWidth);
		const fixed = calcGanttCenterDayIndex(scrollLeft, clientWidth, colWidth);
		expect(fixed).toBe(Math.floor((scrollLeft + (clientWidth - 256) / 2) / colWidth));
		expect(old - fixed).toBeGreaterThanOrEqual(5);
	});

	it('scrollToDate用のスクロール位置は負にならない', () => {
		expect(calcGanttScrollLeftForIndex(0, 24, 1200)).toBe(0);
	});
});
