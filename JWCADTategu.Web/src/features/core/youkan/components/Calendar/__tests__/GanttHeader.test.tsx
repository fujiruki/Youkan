import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import { GanttHeader } from '../GanttHeader';

describe('GanttHeader Component', () => {
	it('should show correct year and month based on visibleDate', () => {
		const date = new Date(2026, 1, 15); // February 2026
		render(
			<GanttHeader
				visibleDate={date}
				onPrevMonth={() => { }}
				onNextMonth={() => { }}
				onGoToCurrentMonth={() => { }}
				onOpenDailySettings={() => { }}
				rowHeight={24}
				onRowHeightChange={() => { }}
				showGroups={true}
				onShowGroupsChange={() => { }}
			/>
		);

		expect(screen.getByText('2026')).toBeInTheDocument();
		expect(screen.getByText('2月')).toBeInTheDocument();
	});

	it('should call onPrevMonth and onNextMonth when buttons are clicked', () => {
		const onPrevMonth = vi.fn();
		const onNextMonth = vi.fn();
		render(
			<GanttHeader
				visibleDate={new Date()}
				onPrevMonth={onPrevMonth}
				onNextMonth={onNextMonth}
				onGoToCurrentMonth={() => { }}
				onOpenDailySettings={() => { }}
				rowHeight={24}
				onRowHeightChange={() => { }}
				showGroups={true}
				onShowGroupsChange={() => { }}
			/>
		);

		const prevButton = screen.getByTitle('前月');
		const nextButton = screen.getByTitle('次月');

		fireEvent.click(prevButton);
		expect(onPrevMonth).toHaveBeenCalledTimes(1);

		fireEvent.click(nextButton);
		expect(onNextMonth).toHaveBeenCalledTimes(1);
	});

	it('should disable "今月を表示" button when visibleDate is current month', () => {
		const date = new Date();
		render(
			<GanttHeader
				visibleDate={date}
				onPrevMonth={() => { }}
				onNextMonth={() => { }}
				onGoToCurrentMonth={() => { }}
				onOpenDailySettings={() => { }}
				rowHeight={24}
				onRowHeightChange={() => { }}
				showGroups={true}
				onShowGroupsChange={() => { }}
			/>
		);

		const currentMonthBtn = screen.getByText('今月を表示');
		expect(currentMonthBtn).toBeDisabled();
	});

	it('should call onOpenDailySettings when 日次設定 button is clicked', () => {
		const onOpenSettings = vi.fn();
		render(
			<GanttHeader
				visibleDate={new Date(2023, 0, 1)}
				onPrevMonth={() => { }}
				onNextMonth={() => { }}
				onGoToCurrentMonth={() => { }}
				onOpenDailySettings={onOpenSettings}
				rowHeight={24}
				onRowHeightChange={() => { }}
				showGroups={true}
				onShowGroupsChange={() => { }}
			/>
		);

		const settingsBtn = screen.getByText('日次設定');
		fireEvent.click(settingsBtn);
		expect(onOpenSettings).toHaveBeenCalledTimes(1);
	});
});
