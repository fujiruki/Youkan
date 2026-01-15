import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DecisionDetailModal } from '../features/core/jbwos/components/Modal/DecisionDetailModal';
import { createMockItem } from './testUtils';

// ToastContextのモック
vi.mock('../contexts/ToastContext', () => ({
    useToast: () => ({
        showToast: vi.fn(),
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

        // コールバック呼び出し確認
        await waitFor(() => {
            expect(mockOnDecision).toHaveBeenCalledWith(
                mockItem.id,
                'yes',
                expect.any(String)
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
                expect.any(String)
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
});
