import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DecisionDetailModal } from './DecisionDetailModal';
import { createMockItem } from '../../../../../test/testUtils';

vi.mock('../../../../../contexts/ToastContext', () => ({
    useToast: () => ({
        showToast: vi.fn(),
    }),
}));

const renderModal = (overrides: Parameters<typeof createMockItem>[0] = {}, onUpdate = vi.fn()) => {
    const item = createMockItem(overrides);
    const utils = render(
        <BrowserRouter>
            <DecisionDetailModal
                item={item}
                onClose={vi.fn()}
                onDecision={vi.fn()}
                onDelete={vi.fn()}
                onUpdate={onUpdate}
            />
        </BrowserRouter>
    );
    return { ...utils, item, onUpdate };
};

const getTitleInput = (): HTMLInputElement | null => {
    return document.querySelector('input[data-testid="decision-detail-title-input"]') as HTMLInputElement | null;
};

describe('DecisionDetailModal — R-037 タイトル編集欄 常時表示', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('タイトルが空文字 "" でも、編集欄 (input) が描画される', async () => {
        renderModal({ title: '' });

        await waitFor(() => {
            const input = getTitleInput();
            expect(input).toBeTruthy();
        });

        const input = getTitleInput()!;
        expect(input.value).toBe('');
        expect(input.placeholder).toMatch(/タイトル未入力|タイトル/);
    });

    it('タイトルが半角スペースのみ "   " でも、編集欄 (input) が描画される', async () => {
        renderModal({ title: '   ' });

        await waitFor(() => {
            const input = getTitleInput();
            expect(input).toBeTruthy();
        });

        expect(getTitleInput()!.value).toBe('   ');
    });

    it('タイトルが全角スペースのみでも、編集欄 (input) が描画される', async () => {
        renderModal({ title: '　　' });

        await waitFor(() => {
            const input = getTitleInput();
            expect(input).toBeTruthy();
        });
    });

    it('タイトルが通常の文字列でも、編集欄 (input) が描画される（h2 ではない）', async () => {
        renderModal({ title: '通常のタイトル' });

        await waitFor(() => {
            const input = getTitleInput();
            expect(input).toBeTruthy();
            expect(input!.value).toBe('通常のタイトル');
        });
    });

    it('空タイトルアイテムに input から文字入力 → onBlur で onUpdate が呼ばれる', async () => {
        const onUpdate = vi.fn().mockResolvedValue(undefined);
        const { item } = renderModal({ title: '' }, onUpdate);

        await waitFor(() => {
            expect(getTitleInput()).toBeTruthy();
        });

        const input = getTitleInput()!;
        fireEvent.change(input, { target: { value: '新しいタイトル' } });
        fireEvent.blur(input);

        await waitFor(() => {
            expect(onUpdate).toHaveBeenCalledWith(
                item.id,
                expect.objectContaining({ title: '新しいタイトル' })
            );
        });
    });
});
