import { describe, it, expect } from 'vitest';
import { computeDailyTimeBlockLayout, DAY_MINUTES } from '../ganttTimeBlocks';

const noPredecessors = () => [];
const noManual = () => undefined;

describe('R-105: computeDailyTimeBlockLayout', () => {
	it('依存も手動調整もないタスクはその日の先頭（0:00）に配置される', () => {
		const layout = computeDailyTimeBlockLayout(
			[{ itemId: 'A', allocatedMinutes: 240 }],
			noPredecessors,
			noManual
		);

		expect(layout.get('A')).toEqual({
			startOffsetMinutes: 0,
			displayWidthMinutes: 240,
			overflow: false,
		});
	});

	it('同日に先行する依存タスクがあれば、その直後から配置される', () => {
		const layout = computeDailyTimeBlockLayout(
			[
				{ itemId: 'A', allocatedMinutes: 240 },
				{ itemId: 'B', allocatedMinutes: 120 },
			],
			(id) => (id === 'B' ? ['A'] : []),
			noManual
		);

		expect(layout.get('A')?.startOffsetMinutes).toBe(0);
		expect(layout.get('B')?.startOffsetMinutes).toBe(240);
		expect(layout.get('B')?.displayWidthMinutes).toBe(120);
	});

	it('依存先が同日に割当を持たない場合は先頭に配置される', () => {
		const layout = computeDailyTimeBlockLayout(
			[{ itemId: 'B', allocatedMinutes: 120 }],
			() => ['A'],
			noManual
		);

		expect(layout.get('B')?.startOffsetMinutes).toBe(0);
	});

	it('複数の先行タスクがあれば最も遅い終了時刻の直後に配置される', () => {
		const layout = computeDailyTimeBlockLayout(
			[
				{ itemId: 'A', allocatedMinutes: 60 },
				{ itemId: 'B', allocatedMinutes: 180 },
				{ itemId: 'C', allocatedMinutes: 60 },
			],
			(id) => (id === 'C' ? ['A', 'B'] : id === 'B' ? ['A'] : []),
			noManual
		);

		// B は A の直後（60分）から 180 分＝240 分で終わる
		expect(layout.get('C')?.startOffsetMinutes).toBe(240);
	});

	it('手動オフセットがあれば自動配置より優先される', () => {
		const layout = computeDailyTimeBlockLayout(
			[
				{ itemId: 'A', allocatedMinutes: 240 },
				{ itemId: 'B', allocatedMinutes: 120 },
			],
			(id) => (id === 'B' ? ['A'] : []),
			(id) => (id === 'B' ? 540 : undefined)
		);

		expect(layout.get('B')?.startOffsetMinutes).toBe(540);
	});

	it('手動オフセットは 0〜1439 分にクランプされる', () => {
		const negative = computeDailyTimeBlockLayout(
			[{ itemId: 'A', allocatedMinutes: 60 }],
			noPredecessors,
			() => -100
		);
		expect(negative.get('A')?.startOffsetMinutes).toBe(0);

		const tooLarge = computeDailyTimeBlockLayout(
			[{ itemId: 'A', allocatedMinutes: 60 }],
			noPredecessors,
			() => 9999
		);
		expect(tooLarge.get('A')?.startOffsetMinutes).toBe(DAY_MINUTES - 1);
	});

	it('24時間をはみ出す場合は overflow フラグが立ち、幅は日末尾までにクランプされる', () => {
		const layout = computeDailyTimeBlockLayout(
			[{ itemId: 'A', allocatedMinutes: 300 }],
			noPredecessors,
			() => 1320 // 22:00 開始 + 5h → 27:00
		);

		expect(layout.get('A')).toEqual({
			startOffsetMinutes: 1320,
			displayWidthMinutes: DAY_MINUTES - 1320,
			overflow: true,
		});
	});

	it('はみ出したタスクの後続は 24:00 を起点に扱われる（さらにはみ出す）', () => {
		const layout = computeDailyTimeBlockLayout(
			[
				{ itemId: 'A', allocatedMinutes: 1500 },
				{ itemId: 'B', allocatedMinutes: 60 },
			],
			(id) => (id === 'B' ? ['A'] : []),
			noManual
		);

		expect(layout.get('A')?.overflow).toBe(true);
		expect(layout.get('B')?.startOffsetMinutes).toBe(DAY_MINUTES - 1);
		expect(layout.get('B')?.overflow).toBe(true);
	});

	it('ちょうど 24 時間ぴったりに収まる場合は overflow しない', () => {
		const layout = computeDailyTimeBlockLayout(
			[{ itemId: 'A', allocatedMinutes: DAY_MINUTES }],
			noPredecessors,
			noManual
		);

		expect(layout.get('A')).toEqual({
			startOffsetMinutes: 0,
			displayWidthMinutes: DAY_MINUTES,
			overflow: false,
		});
	});
});
