import { describe, it, expect } from 'vitest';
import { GANTT_STICKY_COL_WIDTH, calcGanttCenterDayIndex, calcGanttScrollLeftForIndex, canCenterGanttIndex } from '../ganttScroll';

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
