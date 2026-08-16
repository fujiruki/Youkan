import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import { CalendarHeader } from '../CalendarHeader';

describe('CalendarHeader Component', () => {
	it('should show correct year and month based on visibleDate', () => {
		const date = new Date(2026, 1, 15); // February 2026
		render(
			<CalendarHeader
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
			<CalendarHeader
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
			<CalendarHeader
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
			<CalendarHeader
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

	// R-097: マンスリー/ウィークリー表示モード切替＋列幅スライダー
	describe('R-097 スケール表示モード切替＋列幅スライダー', () => {
		const baseProps = {
			visibleDate: new Date(2026, 5, 2),
			onPrevMonth: () => { },
			onNextMonth: () => { },
			onGoToCurrentMonth: () => { },
			onOpenDailySettings: () => { },
			rowHeight: 24,
			onRowHeightChange: () => { },
			showGroups: true,
			onShowGroupsChange: () => { },
		};

		it('gantt variant でマンスリー/ウィークリー切替トグルが表示される', () => {
			render(<CalendarHeader {...baseProps} variant="gantt" scaleMode="monthly" onScaleModeChange={() => { }} colWidth={24} onColWidthChange={() => { }} />);
			expect(screen.getByText('マンスリー')).toBeInTheDocument();
			expect(screen.getByText('ウィークリー')).toBeInTheDocument();
		});

		it('ウィークリーボタン押下で onScaleModeChange("weekly") が呼ばれる', () => {
			const onScaleModeChange = vi.fn();
			render(<CalendarHeader {...baseProps} variant="gantt" scaleMode="monthly" onScaleModeChange={onScaleModeChange} colWidth={24} onColWidthChange={() => { }} />);
			fireEvent.click(screen.getByText('ウィークリー'));
			expect(onScaleModeChange).toHaveBeenCalledWith('weekly');
		});

		it('マンスリーボタン押下で onScaleModeChange("monthly") が呼ばれる', () => {
			const onScaleModeChange = vi.fn();
			render(<CalendarHeader {...baseProps} variant="gantt" scaleMode="weekly" onScaleModeChange={onScaleModeChange} colWidth={24} onColWidthChange={() => { }} />);
			fireEvent.click(screen.getByText('マンスリー'));
			expect(onScaleModeChange).toHaveBeenCalledWith('monthly');
		});

		it('モードに関わらず列幅スライダーと行高さスライダーの両方が常時表示される（monthly）', () => {
			render(<CalendarHeader {...baseProps} variant="gantt" scaleMode="monthly" onScaleModeChange={() => { }} colWidth={24} onColWidthChange={() => { }} />);
			expect(screen.getByLabelText('列幅')).toBeInTheDocument();
			expect(screen.getByLabelText('密度')).toBeInTheDocument();
		});

		it('モードに関わらず列幅スライダーと行高さスライダーの両方が常時表示される（weekly）', () => {
			render(<CalendarHeader {...baseProps} variant="gantt" scaleMode="weekly" onScaleModeChange={() => { }} colWidth={40} onColWidthChange={() => { }} />);
			expect(screen.getByLabelText('列幅')).toBeInTheDocument();
			expect(screen.getByLabelText('密度')).toBeInTheDocument();
		});

		it('列幅スライダー操作で onColWidthChange が呼ばれる', () => {
			const onColWidthChange = vi.fn();
			render(<CalendarHeader {...baseProps} variant="gantt" scaleMode="monthly" onScaleModeChange={() => { }} colWidth={24} onColWidthChange={onColWidthChange} />);
			fireEvent.change(screen.getByLabelText('列幅'), { target: { value: '40' } });
			expect(onColWidthChange).toHaveBeenCalledWith(40);
		});

		it('grid variant では列幅スライダーとスケール切替トグルが表示されない', () => {
			render(<CalendarHeader {...baseProps} variant="grid" scaleMode="monthly" onScaleModeChange={() => { }} colWidth={24} onColWidthChange={() => { }} />);
			expect(screen.queryByLabelText('列幅')).not.toBeInTheDocument();
			expect(screen.queryByText('マンスリー')).not.toBeInTheDocument();
		});

		// R-105: デイリー表示モードを追加（3ボタントグル）
		it('gantt variant でマンスリー/ウィークリー/デイリーの3ボタンが表示される', () => {
			render(<CalendarHeader {...baseProps} variant="gantt" scaleMode="monthly" onScaleModeChange={() => { }} colWidth={24} onColWidthChange={() => { }} />);
			expect(screen.getByText('マンスリー')).toBeInTheDocument();
			expect(screen.getByText('ウィークリー')).toBeInTheDocument();
			expect(screen.getByText('デイリー')).toBeInTheDocument();
		});

		it('デイリーボタン押下で onScaleModeChange("daily") が呼ばれる', () => {
			const onScaleModeChange = vi.fn();
			render(<CalendarHeader {...baseProps} variant="gantt" scaleMode="monthly" onScaleModeChange={onScaleModeChange} colWidth={24} onColWidthChange={() => { }} />);
			fireEvent.click(screen.getByText('デイリー'));
			expect(onScaleModeChange).toHaveBeenCalledWith('daily');
		});

		it('マンスリーの列幅スライダー上限は従来通り80px', () => {
			render(<CalendarHeader {...baseProps} variant="gantt" scaleMode="monthly" onScaleModeChange={() => { }} colWidth={24} onColWidthChange={() => { }} />);
			expect(screen.getByLabelText('列幅')).toHaveAttribute('max', '80');
		});

		it('時間軸タイムライン表示では列幅スライダー上限が広がる', () => {
			render(<CalendarHeader {...baseProps} variant="gantt" scaleMode="daily" onScaleModeChange={() => { }} colWidth={96} onColWidthChange={() => { }} />);
			expect(Number(screen.getByLabelText('列幅').getAttribute('max'))).toBeGreaterThan(80);
		});
	});

	// R-098: コンテンツ印刷ボタン
	describe('R-098 印刷ボタン', () => {
		it('gantt variant で印刷ボタンが表示され、クリックで window.print が呼ばれる', () => {
			const printSpy = vi.spyOn(window, 'print').mockImplementation(() => { });
			render(
				<CalendarHeader
					variant="gantt"
					visibleDate={new Date(2026, 5, 2)}
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
			fireEvent.click(screen.getByTitle('印刷'));
			expect(printSpy).toHaveBeenCalledTimes(1);
			printSpy.mockRestore();
		});
	});

	// R-065: CalendarHeader から「完了を表示」トグルを削除（右上ボタンに一本化）
	describe('R-065 完了を表示トグルは CalendarHeader に存在しない', () => {
		it('gantt variant でも「完了を表示」トグルが描画されない', () => {
			render(
				<CalendarHeader
					variant="gantt"
					visibleDate={new Date(2026, 5, 2)}
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
			expect(screen.queryByRole('switch', { name: /完了を表示/ })).not.toBeInTheDocument();
		});

		it('grid variant でも「完了を表示」トグルが描画されない', () => {
			render(
				<CalendarHeader
					variant="grid"
					visibleDate={new Date(2026, 5, 2)}
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
			expect(screen.queryByRole('switch', { name: /完了を表示/ })).not.toBeInTheDocument();
		});
	});
});
