/**
 * R-137: DecisionDetailModal は currentUserId prop が渡されない呼び出し元が多いため、
 * useAuth（/auth/me）を実効値のフォールバックにする。localStorage['youkan_user']
 * （Cookieセッション認証では常に空）へは、もうフォールバックしないことを確認する。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DecisionDetailModal } from '../DecisionDetailModal';
import { createMockItem } from '../../../../../../test/testUtils';

vi.mock('../../../../../contexts/ToastContext', () => ({
	useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../../../hooks/useExternalEvents', () => ({
	useExternalEvents: () => ({
		eventsByDate: new Map(),
		loading: false,
		error: null,
		refresh: vi.fn(),
		loadMore: vi.fn(),
		loadedRange: { from: '', to: '' },
		isLoadingMore: false,
		loadDirection: null,
	}),
}));

vi.mock('../../../hooks/useGoogleCalendars', () => ({
	useGoogleCalendars: () => ({
		calendars: [],
		loading: false,
		error: null,
		refresh: vi.fn(),
		toggle: vi.fn(),
	}),
}));

let capturedCurrentUserId: string | null | undefined = 'not-called';

vi.mock('../../Inputs/SideCalendarPanel', () => ({
	SideCalendarPanel: ({ currentUserId }: { currentUserId?: string | null }) => {
		capturedCurrentUserId = currentUserId;
		return null;
	},
}));

describe('R-137: DecisionDetailModal の currentUserId 解決（useAuthフォールバック）', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		capturedCurrentUserId = 'not-called';
		localStorage.clear();
	});

	it('currentUserId propが渡されず、localStorageにyoukan_userも無くても、useAuthのuser.idがSideCalendarPanelへ渡る', async () => {
		const item = createMockItem({ title: 'テストアイテム' });
		render(
			<BrowserRouter>
				<DecisionDetailModal
					item={item}
					onClose={vi.fn()}
					onDecision={vi.fn()}
					onDelete={vi.fn()}
					onUpdate={vi.fn()}
				/>
			</BrowserRouter>
		);

		await waitFor(() => {
			expect(screen.getByTestId('decision-detail-title-input')).toBeInTheDocument();
		});

		// setupTests.ts のグローバル useAuth モックの user.id
		expect(capturedCurrentUserId).toBe('test-user');
	});

	it('currentUserId propが渡された場合は、useAuthより優先してそのまま使われる', async () => {
		const item = createMockItem({ title: 'テストアイテム' });
		render(
			<BrowserRouter>
				<DecisionDetailModal
					item={item}
					onClose={vi.fn()}
					onDecision={vi.fn()}
					onDelete={vi.fn()}
					onUpdate={vi.fn()}
					currentUserId="explicit-user"
				/>
			</BrowserRouter>
		);

		await waitFor(() => {
			expect(screen.getByTestId('decision-detail-title-input')).toBeInTheDocument();
		});

		expect(capturedCurrentUserId).toBe('explicit-user');
	});
});
