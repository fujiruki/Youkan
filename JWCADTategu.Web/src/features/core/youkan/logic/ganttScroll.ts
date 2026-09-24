/** ガントの左固定ラベル列の幅(px)。日付列はこの右側から始まり、スクロールしても常に可視領域の左端を占有する */
export const GANTT_STICKY_COL_WIDTH = 256;

const visibleAreaHalf = (clientWidth: number) => (clientWidth - GANTT_STICKY_COL_WIDTH) / 2;

/** 固定列を除いた可視領域の中央にある日付列のindex */
export const calcGanttCenterDayIndex = (scrollLeft: number, clientWidth: number, colWidth: number): number =>
	Math.floor((scrollLeft + visibleAreaHalf(clientWidth)) / colWidth);

/** index番目の日付列を固定列を除いた可視領域の中央に置く scrollLeft */
export const calcGanttScrollLeftForIndex = (index: number, colWidth: number, clientWidth: number): number =>
	Math.max(0, index * colWidth + colWidth / 2 - visibleAreaHalf(clientWidth));
