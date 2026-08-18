import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DecisionDetailModal } from '../features/core/youkan/components/Modal/DecisionDetailModal';
import { createMockItem } from './testUtils';

// ToastContextのモック
vi.mock('../contexts/ToastContext', () => ({
    useToast: () => ({
        showToast: vi.fn(),
    }),
}));

// R-061: 外部イベントフックのモック（ネットワーク不要）
vi.mock('../features/core/youkan/hooks/useExternalEvents', () => ({
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

vi.mock('../features/core/youkan/hooks/useGoogleCalendars', () => ({
    useGoogleCalendars: () => ({
        calendars: [],
        loading: false,
        error: null,
        refresh: vi.fn(),
        toggle: vi.fn(),
    }),
}));

describe('DecisionDetailModal - Interactions', () => {
    const mockItem = createMockItem({
        title: 'インタラクションテスト建具',
        status: 'inbox',
    });

    const mockOnClose = vi.fn();
    const mockOnDecision = vi.fn();
    const mockOnDelete = vi.fn();
    const mockOnUpdate = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('「今日やる」ボタンをクリックすると決定される', async () => {
        render(
            <BrowserRouter>
                <DecisionDetailModal
                    item={mockItem}
                    onClose={mockOnClose}
                    onDecision={mockOnDecision}
                    onDelete={mockOnDelete}
                    onUpdate={mockOnUpdate}
                />
            </BrowserRouter>
        );

        // テキストを含むボタンを直接探すロジック
        // waitForを使って要素の出現を待機
        await waitFor(() => {
            const buttons = screen.getAllByRole('button');
            const yesButton = buttons.find(b => b.textContent?.includes('今日やる'));
            expect(yesButton).toBeTruthy();
            if (yesButton) {
                fireEvent.click(yesButton);
            }
        }, { timeout: 3000 });

        // コールバック呼び出し確認（実装は 4 引数: id, decision, note, extra）
        await waitFor(() => {
            expect(mockOnDecision).toHaveBeenCalledWith(
                mockItem.id,
                'yes',
                expect.any(String),
                expect.any(Object)
            );
        });
    });

    it('Ctrl+Enterですぐに決定される', async () => {
        render(
            <BrowserRouter>
                <DecisionDetailModal
                    item={mockItem}
                    onClose={mockOnClose}
                    onDecision={mockOnDecision}
                    onDelete={mockOnDelete}
                    onUpdate={mockOnUpdate}
                />
            </BrowserRouter>
        );

        fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });

        await waitFor(() => {
            expect(mockOnDecision).toHaveBeenCalledWith(
                mockItem.id,
                'yes',
                expect.any(String),
                expect.any(Object)
            );
        });
    });

    it('Escapeキーでモーダルが閉じられる', async () => {
        render(
            <BrowserRouter>
                <DecisionDetailModal
                    item={mockItem}
                    onClose={mockOnClose}
                    onDecision={mockOnDecision}
                    onDelete={mockOnDelete}
                    onUpdate={mockOnUpdate}
                />
            </BrowserRouter>
        );

        fireEvent.keyDown(window, { key: 'Escape' });

        await waitFor(() => {
            expect(mockOnClose).toHaveBeenCalled();
        });
    });

    it('R-131: Ctrl+Shift+Hで「保留にする」が実行される', async () => {
        render(
            <BrowserRouter>
                <DecisionDetailModal
                    item={mockItem}
                    onClose={mockOnClose}
                    onDecision={mockOnDecision}
                    onDelete={mockOnDelete}
                    onUpdate={mockOnUpdate}
                />
            </BrowserRouter>
        );

        fireEvent.keyDown(window, { key: 'H', ctrlKey: true, shiftKey: true });

        await waitFor(() => {
            expect(mockOnDecision).toHaveBeenCalledWith(
                mockItem.id,
                'hold',
                expect.any(String),
                expect.any(Object)
            );
        });
    });

    it('R-131: 保留ボタンのtitleにショートカットが表記される', async () => {
        render(
            <BrowserRouter>
                <DecisionDetailModal
                    item={mockItem}
                    onClose={mockOnClose}
                    onDecision={mockOnDecision}
                    onDelete={mockOnDelete}
                    onUpdate={mockOnUpdate}
                />
            </BrowserRouter>
        );

        await waitFor(() => {
            const buttons = screen.getAllByRole('button');
            const holdButton = buttons.find(b => b.textContent?.includes('保留にする'));
            expect(holdButton).toBeTruthy();
            expect(holdButton?.getAttribute('title')).toBe('Ctrl+Shift+H');
        });
    });

    it('R-131: 入力欄にフォーカス中はCtrl+Shift+Hを無視する', async () => {
        render(
            <BrowserRouter>
                <DecisionDetailModal
                    item={mockItem}
                    onClose={mockOnClose}
                    onDecision={mockOnDecision}
                    onDelete={mockOnDelete}
                    onUpdate={mockOnUpdate}
                />
            </BrowserRouter>
        );

        const titleInput = await screen.findByTestId('decision-detail-title-input');
        titleInput.focus();
        fireEvent.keyDown(titleInput, { key: 'H', ctrlKey: true, shiftKey: true });

        // 少し待ってもhold決定は呼ばれない
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(mockOnDecision).not.toHaveBeenCalledWith(
            mockItem.id,
            'hold',
            expect.any(String),
            expect.any(Object)
        );
    });
});
