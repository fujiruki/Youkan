import { describe, it, expect } from 'vitest';
import { GANTT_STICKY_COL_WIDTH, calcGanttCenterDayIndex, calcGanttScrollLeftForIndex } from '../ganttScroll';

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
