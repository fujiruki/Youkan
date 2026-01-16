import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DecisionDetailModal } from './DecisionDetailModal';
import { Item } from '../../types';

describe('DecisionDetailModal', () => {
    const mockItem = {
        id: '1',
        title: 'Test Item',
        status: 'inbox',
        updatedAt: 1234567890
    } as unknown as Item;

    const defaultProps = {
        item: mockItem,
        onClose: vi.fn(),
        onDecision: vi.fn(),
        onDelete: vi.fn(),
        onUpdate: vi.fn(),
        yesButtonLabel: '今日やる'
    };

    it('renders the new correct button labels', () => {
        render(<DecisionDetailModal {...defaultProps} />);

        // 1. Check for "今は隠す (Sleep)"
        expect(screen.getByText(/今は隠す/)).toBeDefined();
        // 2. Check for "スタンバイに置く"
        expect(screen.getByText(/スタンバイに置く/)).toBeDefined();
        // 3. Check for "今日やる"
        expect(screen.getByText(/今日やる/)).toBeDefined();
    });

    it('calls onDecision("hold") when "今は隠す (Sleep)" is clicked', async () => {
        render(<DecisionDetailModal {...defaultProps} />);

        fireEvent.click(screen.getByText(/今は隠す/));
        await waitFor(() => {
            expect(defaultProps.onDecision).toHaveBeenCalledWith('1', 'hold', expect.any(String));
        });
    });

    it('calls onDecision("yes") when "今日やる" is clicked', async () => {
        render(<DecisionDetailModal {...defaultProps} />);

        fireEvent.click(screen.getByText(/今日やる/));
        await waitFor(() => {
            expect(defaultProps.onDecision).toHaveBeenCalledWith('1', 'yes', expect.any(String));
        });
    });

    it('calls onClose (Save) when "スタンバイに置く" is clicked', async () => {
        render(<DecisionDetailModal {...defaultProps} />);

        // Use a more specific selector if needed, or by text
        fireEvent.click(screen.getByText(/スタンバイに置く/));

        // This button calls handleClose, which calls saveChanges (onUpdate) then onClose
        // Since we didn't change anything, onUpdate might be called with same title or logic dep.
        // But definitely onClose should be called.
        // (Await might be needed if handleClose is async, but fireEvent usually wraps it well enough for simple mocks, 
        //  actually handleClose is async so we might need waitFor or check invocation)

        // Since handleClose calls await saveChanges(), we might need to wait on the promise chain 
        // but for a unit test with mocked functions, checking call order is tricky without real async act.
        // However, let's just assert it was called eventually.

        await waitFor(() => {
            expect(defaultProps.onClose).toHaveBeenCalled();
        });
    });
});
