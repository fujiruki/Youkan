import { describe, it, expect, vi } from 'vitest';
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

describe('DecisionDetailModal', () => {
    const mockItem = createMockItem({
        title: 'テスト建具',
        status: 'inbox',
    });

    const mockOnClose = vi.fn();
    const mockOnDecision = vi.fn();
    const mockOnDelete = vi.fn();

    it('アイテムのタイトルが表示される', () => {
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

        expect(screen.getByText(/テスト建具/i)).toBeInTheDocument();
    });
});
