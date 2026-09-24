import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { RyokanGanttView } from '../RyokanGanttView';
import { ToastProvider } from '../../../../../../contexts/ToastContext';

/**
 * R-0168 根本原因: ヘッダー↔本体の scrollLeft 同期が、本体の smooth スクロール中に
 * 「前フレームでヘッダーへ書いた古い値」を本体へ書き戻し、アニメーションを打ち切っていた
 * （実測: 1クリックで +2〜11px しか動かない）。
 * 自分が書き込んだ値の echo イベントは無視し、相手の実際の移動だけを同期する。
 */

const makeAllDays = (months: number): Date[] => {
	const days: Date[] = [];
	for (let m = 0; m < months; m++) {
		const n = new Date(2026, m + 1, 0).getDate();
		for (let d = 1; d <= n; d++) days.push(new Date(2026, m, d));
	}
	return days;
};

const props = {
	allDays: makeAllDays(6),
	items: [],
	heatMap: new Map(),
	today: new Date(2026, 2, 15),
	safeConfig: {},
	rowHeight: 28,
	projects: [],
	renderItemTitle: () => '',
	showGroups: false,
};

describe('R-0168 ガント ヘッダー↔本体 scrollLeft 同期', () => {
	let rafQueue: FrameRequestCallback[];
	const flushFrame = () => rafQueue.splice(0).forEach(cb => cb(0));

	beforeEach(() => {
		rafQueue = [];
		vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => { rafQueue.push(cb); return 0; });
	});
	afterEach(() => vi.restoreAllMocks());

	const mount = () => {
		const { container } = render(<ToastProvider><RyokanGanttView {...props} /></ToastProvider>);
		const header = container.querySelector('.overflow-x-scroll') as HTMLDivElement;
		const body = container.querySelector('.flex-1.overflow-auto') as HTMLDivElement;
		expect(header).not.toBeNull();
		expect(body).not.toBeNull();
		return { header, body };
	};

	it('本体の smooth スクロール中に届くヘッダーの echo イベントで、本体が古い位置へ戻されない', () => {
		const { header, body } = mount();

		body.scrollLeft = 1320;
		fireEvent.scroll(body);
		expect(header.scrollLeft).toBe(1320);
		flushFrame();

		body.scrollLeft = 1345;
		fireEvent.scroll(header);
		expect(body.scrollLeft).toBe(1345);

		fireEvent.scroll(body);
		expect(header.scrollLeft).toBe(1345);
	});

	it('ヘッダーをユーザーがスクロールした場合は本体へ同期され、直前の同期値へ戻す操作も反映される', () => {
		const { header, body } = mount();

		body.scrollLeft = 1345;
		fireEvent.scroll(body);
		flushFrame();
		expect(header.scrollLeft).toBe(1345);

		header.scrollLeft = 1400;
		fireEvent.scroll(header);
		flushFrame();
		expect(body.scrollLeft).toBe(1400);

		header.scrollLeft = 1345;
		fireEvent.scroll(header);
		flushFrame();
		expect(body.scrollLeft).toBe(1345);
	});
});
