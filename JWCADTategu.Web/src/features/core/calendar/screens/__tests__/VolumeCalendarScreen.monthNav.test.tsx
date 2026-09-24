import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, fireEvent, screen } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';

/**
 * R-0168-C: 矢印クリック起点のスクロール中に届く visibleMonth の反映で、
 * currentDate が矢印で指定した月からずれて月を飛び越さない
 */

const captured: { onVisibleMonthChange?: (d: Date) => void } = {};
const scrollToMonth = vi.fn();

vi.mock('../../viewmodels/useVolumeCalendarViewModel', async () => {
	const React = await import('react');
	return {
		useVolumeCalendarViewModel: () => {
			const [currentDate, setCurrentDate] = React.useState(new Date(2026, 8, 1));
			return {
				currentDate, setCurrentDate,
				items: [], completedItems: [], members: [], projects: [], loading: false, error: null,
				handlePrevMonth: () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)),
				handleNextMonth: () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)),
				refresh: vi.fn(), capacityConfig: null, handleUpdateCapacityException: vi.fn()
			};
		}
	};
});
vi.mock('../../../youkan/contexts/FilterContext', () => ({ useFilter: () => ({ filterMode: 'all', hideCompleted: false }) }));
vi.mock('../../../youkan/contexts/ViewModeContext', () => ({ useViewMode: () => ({ calendarViewMode: 'gantt' }) }));
vi.mock('../../../auth/providers/AuthProvider', () => ({ useAuth: () => ({ user: null, tenant: null, joinedTenants: [] }) }));
vi.mock('../../../youkan/hooks/useExternalEvents', () => ({
	useExternalEvents: () => ({ eventsByDate: {}, loadMore: vi.fn(), loadedRange: null, isLoadingMore: false, loadDirection: null })
}));
vi.mock('../../../youkan/hooks/useGoogleCalendars', () => ({ useGoogleCalendars: () => ({ calendars: [] }) }));
vi.mock('../../../youkan/components/Calendar/CalendarToggleButton', () => ({ CalendarToggleButton: () => null }));
vi.mock('../../../youkan/components/Modal/DecisionDetailModal', () => ({ DecisionDetailModal: () => null }));
vi.mock('../../../youkan/components/Calendar/CalendarHeader', () => ({
	CalendarHeader: (p: any) => (
		<div>
			<span data-testid="label">{p.visibleDate.getMonth() + 1}</span>
			<button onClick={p.onPrevMonth}>prev</button>
			<button onClick={p.onNextMonth}>next</button>
			<button onClick={p.onGoToCurrentMonth}>today</button>
		</div>
	)
}));
vi.mock('../../../youkan/components/Calendar/RyokanCalendar', async () => {
	const React = await import('react');
	return {
		RyokanCalendar: React.forwardRef((p: any, ref: any) => {
			captured.onVisibleMonthChange = p.onVisibleMonthChange;
			React.useImperativeHandle(ref, () => ({ scrollToMonth, scrollToToday: vi.fn(), openDailySettings: vi.fn() }));
			return null;
		})
	};
});

import { VolumeCalendarScreen } from '../VolumeCalendarScreen';

describe('R-0168-C VolumeCalendarScreen 月移動', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		scrollToMonth.mockClear();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('次月を4回押すとスクロール中の月ずれ通知があっても Oct→Nov→Dec→Jan と1ヶ月ずつ進む', () => {
		render(<VolumeCalendarScreen onNavigateHome={() => { }} />);
		expect(screen.getByTestId('label')).toHaveTextContent('9');

		const expected = ['10', '11', '12', '1'];
		const driftedNext = [new Date(2026, 10, 1), new Date(2026, 11, 1), new Date(2027, 0, 1), new Date(2027, 1, 1)];
		expected.forEach((label, i) => {
			fireEvent.click(screen.getByText('next'));
			act(() => { captured.onVisibleMonthChange?.(driftedNext[i]); });
			act(() => { vi.advanceTimersByTime(300); });
			expect(screen.getByTestId('label')).toHaveTextContent(label);
		});
		expect(scrollToMonth.mock.calls.map(c => c[1])).toEqual([9, 10, 11, 0]);
	});

	it('矢印から十分時間が経ったスクロール由来の月通知は従来どおり反映される', () => {
		render(<VolumeCalendarScreen onNavigateHome={() => { }} />);
		fireEvent.click(screen.getByText('next'));
		act(() => { vi.advanceTimersByTime(2000); });
		act(() => { captured.onVisibleMonthChange?.(new Date(2026, 11, 1)); });
		act(() => { vi.advanceTimersByTime(300); });
		expect(screen.getByTestId('label')).toHaveTextContent('12');
	});
});
