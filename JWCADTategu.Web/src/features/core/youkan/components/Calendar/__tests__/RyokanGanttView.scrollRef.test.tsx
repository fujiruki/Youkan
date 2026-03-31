import { describe, it, expect, vi } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import React, { createRef } from 'react';
import { RyokanGanttView } from '../RyokanGanttView';

/**
 * scrollRef二重管理バグのテスト
 *
 * 親からscrollRefが渡された場合:
 * - スクロールイベントリスナーがscrollRef.currentに登録されること
 * - onVisibleMonthChangeがスクロール時に呼ばれること
 */

const makeAllDays = (startMonth: number, months: number): Date[] => {
	const days: Date[] = [];
	for (let m = startMonth; m < startMonth + months; m++) {
		const daysInMonth = new Date(2026, m + 1, 0).getDate();
		for (let d = 1; d <= daysInMonth; d++) {
			days.push(new Date(2026, m, d));
		}
	}
	return days;
};

const defaultProps = {
	items: [],
	heatMap: new Map(),
	today: new Date(2026, 2, 15),
	safeConfig: {},
	rowHeight: 40,
	projects: [],
	renderItemTitle: () => '',
	showGroups: false,
};

describe('RyokanGanttView scrollRef二重管理バグ', () => {
	it('scrollRefが渡された場合、スクロール時にonVisibleMonthChangeが呼ばれること', async () => {
		const onVisibleMonthChange = vi.fn();
		const scrollRef = createRef<HTMLDivElement>();

		const allDays = makeAllDays(0, 6); // 1月〜6月

		render(
			<RyokanGanttView
				allDays={allDays}
				{...defaultProps}
				onVisibleMonthChange={onVisibleMonthChange}
				scrollRef={scrollRef}
			/>
		);

		// scrollRefが実際のDOM要素に紐づいていること
		expect(scrollRef.current).not.toBeNull();

		// 初期レンダリング時にonVisibleMonthChangeが呼ばれること（初回同期）
		expect(onVisibleMonthChange).toHaveBeenCalled();

		// スクロールイベントを発火
		onVisibleMonthChange.mockClear();
		act(() => {
			fireEvent.scroll(scrollRef.current!);
		});

		// スクロール後にonVisibleMonthChangeが呼ばれること
		expect(onVisibleMonthChange).toHaveBeenCalled();
	});

	it('scrollRefが渡されない場合も、スクロール時にonVisibleMonthChangeが呼ばれること', async () => {
		const onVisibleMonthChange = vi.fn();
		const allDays = makeAllDays(0, 6);

		const { container } = render(
			<RyokanGanttView
				allDays={allDays}
				{...defaultProps}
				onVisibleMonthChange={onVisibleMonthChange}
			/>
		);

		// 初期レンダリング時にonVisibleMonthChangeが呼ばれること
		expect(onVisibleMonthChange).toHaveBeenCalled();

		// ボディのスクロールコンテナを取得
		const scrollContainer = container.querySelector('.flex-1.overflow-auto');
		expect(scrollContainer).not.toBeNull();

		onVisibleMonthChange.mockClear();
		act(() => {
			fireEvent.scroll(scrollContainer!);
		});

		expect(onVisibleMonthChange).toHaveBeenCalled();
	});
});
