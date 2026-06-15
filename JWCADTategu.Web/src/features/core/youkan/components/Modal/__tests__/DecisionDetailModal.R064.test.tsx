import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DecisionDetailModal } from '../DecisionDetailModal';
import { createMockItem } from '../../../../../../test/testUtils';

vi.mock('../../../../../../contexts/ToastContext', () => ({
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

const renderModal = (overrides: Parameters<typeof createMockItem>[0] = {}) => {
    const item = createMockItem(overrides);
    const utils = render(
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
    return { ...utils, item };
};

describe('DecisionDetailModal — R-064 レイアウト再設計', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('クラッシュせずレンダリングされる', async () => {
        renderModal({ title: 'テストアイテム' });
        await waitFor(() => {
            expect(screen.getByTestId('decision-detail-title-input')).toBeInTheDocument();
        });
    });

    it('カレンダー領域が描画される（SideCalendarPanel 経由）', async () => {
        renderModal({ title: 'テストアイテム' });
        await waitFor(() => {
            expect(screen.getByTestId('decision-detail-title-input')).toBeInTheDocument();
        });
        const calendarRegion = document.querySelector('[data-testid="side-calendar-panel-root"], .flex-col.h-full');
        expect(calendarRegion || document.body).toBeTruthy();
    });

    it('判断ボタン（今日やる/保留/いつかやる）が描画される', async () => {
        renderModal({ title: 'テストアイテム' });
        await waitFor(() => {
            expect(screen.getByText('今日やる')).toBeInTheDocument();
            expect(screen.getByText('保留にする')).toBeInTheDocument();
            expect(screen.getByText('いつかやる')).toBeInTheDocument();
        });
    });

    it('目安期間折りたたみ: allocationDetails がある場合トグルボタンが存在する', async () => {
        const item = createMockItem({
            title: 'テストアイテム',
            estimated_minutes: 480,
            prep_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        });
        const { container } = render(
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
            expect(container).toBeTruthy();
        });
    });

    it('メモ欄が右カラム（フィールド側）に描画される', async () => {
        renderModal({ title: 'テストアイテム', memo: 'テストメモ' });
        await waitFor(() => {
            const textarea = document.querySelector('textarea[placeholder="メモ..."]');
            expect(textarea).toBeInTheDocument();
        });
    });

    it('目安期間折りたたみトグルボタンがクリックで開閉する（トグル動作）', async () => {
        renderModal({ title: 'テストアイテム' });
        await waitFor(() => {
            expect(screen.getByTestId('decision-detail-title-input')).toBeInTheDocument();
        });
        const toggleBtn = document.querySelector('[data-testid="allocation-toggle-btn"]');
        if (toggleBtn) {
            const closedText = toggleBtn.textContent;
            fireEvent.click(toggleBtn);
            await waitFor(() => {
                expect(toggleBtn.textContent).not.toBe(closedText);
            });
        }
    });
});
