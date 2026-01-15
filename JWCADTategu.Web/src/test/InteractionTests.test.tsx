import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DecisionDetailModal } from '../features/core/jbwos/components/Modal/DecisionDetailModal';
import { createMockItem } from './testUtils';

// ToastContextのモック
vi.mock('../contexts/ToastContext', () => ({
    useToast: () => ({
        showToast: vi.fn(),
    }),
}));

describe('DecisionDetailModal - Basic Rendering', () => {
    const mockItem = createMockItem({
        title: 'レンダリングテスト',
        status: 'inbox',
    });

    const mockOnClose = vi.fn();
    const mockOnDecision = vi.fn();
    const mockOnDelete = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('モーダルが正しく表示される', () => {
        render(
            <BrowserRouter>
                <DecisionDetailModal
                    item={mockItem}
                    onClose={mockOnClose}
                    onDecision={mockOnDecision}
                    onDelete={mockOnDelete}
                />
            </BrowserRouter>
        );

        // アイテムタイトルが表示されている
        expect(screen.getByText(/レンダリングテスト/i)).toBeInTheDocument();
    });

    it('複数のアイテムでモーダルがレンダリングできる', () => {
        const items = [
            createMockItem({ title: 'アイテム1' }),
            createMockItem({ title: 'アイテム2' }),
            createMockItem({ title: 'アイテム3' }),
        ];

        items.forEach((item) => {
            const { unmount } = render(
                <BrowserRouter>
                    <DecisionDetailModal
                        item={item}
                        onClose={mockOnClose}
                        onDecision={mockOnDecision}
                        onDelete={mockOnDelete}
                    />
                </BrowserRouter>
            );

            expect(screen.getByText(new RegExp(item.title, 'i'))).toBeInTheDocument();
            unmount();
        });
    });
});
