import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DecisionDetailModal } from './DecisionDetailModal';
import { createMockItem } from '../../../../../test/testUtils';

vi.mock('../../../../../contexts/ToastContext', () => ({
    useToast: () => ({
        showToast: vi.fn(),
    }),
}));

// R-061: 外部イベントフックのモック（ネットワーク不要）
vi.mock('../../hooks/useExternalEvents', () => ({
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

vi.mock('../../hooks/useGoogleCalendars', () => ({
    useGoogleCalendars: () => ({
        calendars: [],
        loading: false,
        error: null,
        refresh: vi.fn(),
        toggle: vi.fn(),
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

describe('DecisionDetailModal — R-073 納期フィールドのブラー時 due_status 意図しない変化防止', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const getDueDateInput = (): HTMLInputElement => {
        // 納期欄・マイ期限欄の両方が同じ placeholder を使うため、DOM順で先頭（納期欄）を取得する
        return screen.getAllByPlaceholderText("YYYY/MM/DD or 'tomorrow'")[0] as HTMLInputElement;
    };

    it('納期を変更せずクリックしてブラーしても、dueStatus: confirmed は送信されない', async () => {
        const onUpdate = vi.fn().mockResolvedValue(undefined);
        renderModal({ due_date: '2026-07-31', dueStatus: null }, onUpdate);

        await waitFor(() => {
            expect(getDueDateInput()).toBeTruthy();
        });

        const dueInput = getDueDateInput();
        fireEvent.focus(dueInput);
        fireEvent.blur(dueInput);

        const calledWithConfirmed = onUpdate.mock.calls.some(
            (call) => call[1] && (call[1] as { dueStatus?: string }).dueStatus === 'confirmed'
        );
        expect(calledWithConfirmed).toBe(false);
    });

    it('納期を実際に変更してブラーすると、due_date と dueStatus: confirmed が送信される', async () => {
        const onUpdate = vi.fn().mockResolvedValue(undefined);
        const { item } = renderModal({ due_date: '2026-07-31', dueStatus: null }, onUpdate);

        await waitFor(() => {
            expect(getDueDateInput()).toBeTruthy();
        });

        const dueInput = getDueDateInput();
        fireEvent.focus(dueInput);
        fireEvent.change(dueInput, { target: { value: '2026/08/15' } });
        fireEvent.blur(dueInput);

        await waitFor(() => {
            expect(onUpdate).toHaveBeenCalledWith(
                item.id,
                expect.objectContaining({ due_date: '2026-08-15', dueStatus: 'confirmed' })
            );
        });
    });
});

describe('DecisionDetailModal — R-082 PC幅で「完了」「プロジェクトに変換」をその他メニューから独立ボタン化', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('PC表示時、「完了」ボタンがFooter Action Barに独立表示され、クリックで即座に完了処理される', async () => {
        const onUpdate = vi.fn().mockResolvedValue(undefined);
        const { item } = renderModal({ title: 'テストアイテム', status: 'inbox' }, onUpdate);

        await waitFor(() => {
            expect(screen.getByTestId('decision-detail-title-input')).toBeInTheDocument();
        });

        const completeBtn = screen.getByTestId('footer-complete-btn');
        fireEvent.click(completeBtn);

        await waitFor(() => {
            expect(onUpdate).toHaveBeenCalledWith(
                item.id,
                expect.objectContaining({ status: 'done' })
            );
        });
    });

    it('PC表示時、「プロジェクトに変換」ボタンがFooter Action Barに独立表示され、クリックで即座に変換処理される', async () => {
        const onUpdate = vi.fn().mockResolvedValue(undefined);
        const { item } = renderModal({ title: 'テストアイテム', isProject: false }, onUpdate);

        await waitFor(() => {
            expect(screen.getByTestId('decision-detail-title-input')).toBeInTheDocument();
        });

        const projectBtn = screen.getByTestId('footer-project-toggle-btn');
        fireEvent.click(projectBtn);

        await waitFor(() => {
            expect(onUpdate).toHaveBeenCalledWith(
                item.id,
                expect.objectContaining({ isProject: true })
            );
        });
    });

    it('PC表示時、その他メニュー（ポップオーバー）内には「いつかやる」「アーカイブ」「ゴミ箱」のみが残り、「完了」「プロジェクトに変換」は含まれない', async () => {
        renderModal({ title: 'テストアイテム' });

        await waitFor(() => {
            expect(screen.getByTestId('decision-detail-title-input')).toBeInTheDocument();
        });

        const menuBtn = screen.getByText('その他...');
        fireEvent.click(menuBtn);

        await waitFor(() => {
            expect(screen.getByText('場所・状態の変更')).toBeInTheDocument();
        });

        const popover = screen.getByText('場所・状態の変更').closest('div')!.parentElement as HTMLElement;
        expect(within(popover).getByText(/いつかやる/)).toBeInTheDocument();
        expect(within(popover).getByText('アーカイブ')).toBeInTheDocument();
        expect(within(popover).getByText('ゴミ箱')).toBeInTheDocument();
        expect(within(popover).queryByText(/完了 \(Complete\)/)).not.toBeInTheDocument();
        expect(within(popover).queryByText(/プロジェクトに変換/)).not.toBeInTheDocument();
    });
});
