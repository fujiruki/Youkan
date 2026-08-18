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

	it('手動オフセットは負なら 0 に、大きすぎれば幅を保って右端揃えになる', () => {
		const negative = computeDailyTimeBlockLayout(
			[{ itemId: 'A', allocatedMinutes: 60 }],
			noPredecessors,
			() => -100
		);
		expect(negative.get('A')?.startOffsetMinutes).toBe(0);

		// R-145: 仕様 F-40「右端を24:00に揃える（幅は保つ）」に合わせる（旧: 1439 に据え置き）
		const tooLarge = computeDailyTimeBlockLayout(
			[{ itemId: 'A', allocatedMinutes: 60 }],
			noPredecessors,
			() => 9999
		);
		expect(tooLarge.get('A')).toEqual({
			startOffsetMinutes: DAY_MINUTES - 60,
			displayWidthMinutes: 60,
			overflow: true,
		});
	});

	it('24時間をはみ出す場合は overflow フラグが立ち、幅を保ったまま右端が 24:00 に揃う', () => {
		// R-145: 仕様 F-40 に合わせる（旧: 開始据え置きで幅を切り落としていた）
		const layout = computeDailyTimeBlockLayout(
			[{ itemId: 'A', allocatedMinutes: 300 }],
			noPredecessors,
			() => 1320 // 22:00 開始 + 5h → 27:00
		);

		expect(layout.get('A')).toEqual({
			startOffsetMinutes: DAY_MINUTES - 300,
			displayWidthMinutes: 300,
			overflow: true,
		});
	});

	it('R-145: 手動オフセット飽和値 1439 ＋ 6h は 18:00 開始・6h 幅・overflow', () => {
		const layout = computeDailyTimeBlockLayout(
			[{ itemId: 'A', allocatedMinutes: 360 }],
			noPredecessors,
			() => DAY_MINUTES - 1
		);

		expect(layout.get('A')).toEqual({
			startOffsetMinutes: 18 * 60,
			displayWidthMinutes: 360,
			overflow: true,
		});
	});

	it('はみ出したタスクの後続は 24:00 を起点に扱われ、幅を保って右端揃えになる（1分幅にならない）', () => {
		// R-145: 仕様 F-40 に合わせる（旧: 1439 起点で幅1分になっていた）
		const layout = computeDailyTimeBlockLayout(
			[
				{ itemId: 'A', allocatedMinutes: 1500 },
				{ itemId: 'B', allocatedMinutes: 60 },
			],
			(id) => (id === 'B' ? ['A'] : []),
			noManual
		);

		expect(layout.get('A')).toEqual({
			startOffsetMinutes: 0,
			displayWidthMinutes: DAY_MINUTES,
			overflow: true,
		});
		expect(layout.get('B')).toEqual({
			startOffsetMinutes: DAY_MINUTES - 60,
			displayWidthMinutes: 60,
			overflow: true,
		});
	});

	it('R-145: 先行が 24:00 ちょうどで終わる場合も後続は 1 分幅にならない', () => {
		const layout = computeDailyTimeBlockLayout(
			[
				{ itemId: 'A', allocatedMinutes: 1200 },
				{ itemId: 'B', allocatedMinutes: 240 },
				{ itemId: 'C', allocatedMinutes: 120 },
			],
			(id) => (id === 'B' ? ['A'] : id === 'C' ? ['B'] : []),
			noManual
		);

		expect(layout.get('B')?.overflow).toBe(false);
		expect(layout.get('C')).toEqual({
			startOffsetMinutes: DAY_MINUTES - 120,
			displayWidthMinutes: 120,
			overflow: true,
		});
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
