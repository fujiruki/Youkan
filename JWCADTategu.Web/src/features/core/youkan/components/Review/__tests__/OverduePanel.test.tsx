import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { OverduePanel } from '../OverduePanel';
import { OverdueGroup, OverdueItem } from '../../../logic/overdueGroups';

const TODAY = '2026-08-18';

const buildGroup = (overrides: Partial<OverdueGroup> = {}): OverdueGroup => ({
    projectId: 'p1',
    groupTitle: '田中様／玄関建具',
    items: [
        { id: 'a', title: 'タスクA', estimatedMinutes: 120, deadlineField: 'due_date', deadline: new Date('2026-08-10').getTime(), overdueDays: 8, meta: null },
        { id: 'b', title: 'タスクB', estimatedMinutes: 60, deadlineField: 'due_date', deadline: new Date('2026-08-16').getTime(), overdueDays: 2, meta: { flow_x: 1 } },
    ],
    totalMinutes: 180,
    oldestOverdueDays: 8,
    contacted: false,
    contactedAt: null,
    ...overrides,
});

const buildItems = (count: number): OverdueItem[] =>
    Array.from({ length: count }, (_, i) => ({
        id: `item-${i}`,
        title: `タスク${i}`,
        estimatedMinutes: 60,
        deadlineField: 'due_date',
        deadline: new Date('2026-08-10').getTime(),
        overdueDays: 8,
        meta: null,
    }));

describe('OverduePanel (R-136 / F-55)', () => {
    it('見出しに件数と合計hを表示する（R-148: 接頭辞は「期限超過」）', () => {
        render(<OverduePanel groups={[buildGroup()]} today={TODAY} onUpdateItem={vi.fn()} onClose={vi.fn()} />);
        expect(screen.getByText(/期限超過\s*2件/)).toBeInTheDocument();
        expect(screen.queryByText(/超過分\s*2件/)).toBeNull();
        expect(screen.getByText(/合計\s*3h/)).toBeInTheDocument();
    });

    it('ブロック見出しに案件名・件数・合計h・最古超過日数を表示する', () => {
        render(<OverduePanel groups={[buildGroup()]} today={TODAY} onUpdateItem={vi.fn()} onClose={vi.fn()} />);
        expect(screen.getByText('田中様／玄関建具')).toBeInTheDocument();
        expect(screen.getByText(/2件・3h・最古8日超過/)).toBeInTheDocument();
    });

    it('行にタイトル・目安h・超過日数を表示する', () => {
        render(<OverduePanel groups={[buildGroup()]} today={TODAY} onUpdateItem={vi.fn()} onClose={vi.fn()} />);
        expect(screen.getByText('タスクA')).toBeInTheDocument();
        expect(screen.getByText('8/10', { exact: false })).toBeInTheDocument();
        // 行の超過日数（完全一致。ブロック見出しの「最古8日超過」は同じ要素内に他の文字も含むため別扱い）
        expect(screen.getByText('8日超過')).toBeInTheDocument();
    });

    it('Escキーで onClose が呼ばれる', () => {
        const onClose = vi.fn();
        render(<OverduePanel groups={[buildGroup()]} today={TODAY} onUpdateItem={vi.fn()} onClose={onClose} />);
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
    });

    it('閉じるボタンで onClose が呼ばれる', () => {
        const onClose = vi.fn();
        render(<OverduePanel groups={[buildGroup()]} today={TODAY} onUpdateItem={vi.fn()} onClose={onClose} />);
        fireEvent.click(screen.getByTitle('閉じる (Esc)'));
        expect(onClose).toHaveBeenCalled();
    });

    it('納期入力欄でEnterするとonUpdateItemがdue_dateで呼ばれる', () => {
        const onUpdateItem = vi.fn();
        render(<OverduePanel groups={[buildGroup()]} today={TODAY} onUpdateItem={onUpdateItem} onClose={vi.fn()} />);
        const inputs = screen.getAllByPlaceholderText("YYYY/MM/DD or 'tomorrow'");
        inputs[0].focus();
        fireEvent.change(inputs[0], { target: { value: '2026/08/25' } });
        fireEvent.keyDown(inputs[0], { key: 'Enter' });
        expect(onUpdateItem).toHaveBeenCalledWith('a', { due_date: '2026-08-25' });
        expect(screen.getAllByText('納期').length).toBe(2);
    });

    it('R-147: 有効締切が prep_date の行は「マイ期限」ラベルで prep_date（Unix秒）を更新する', () => {
        const onUpdateItem = vi.fn();
        const group = buildGroup({
            items: [
                { id: 'a', title: 'タスクA', estimatedMinutes: 120, deadlineField: 'prep_date', deadline: new Date('2026-08-10').getTime(), overdueDays: 8, meta: null },
            ],
        });
        render(<OverduePanel groups={[group]} today={TODAY} onUpdateItem={onUpdateItem} onClose={vi.fn()} />);
        expect(screen.getByText('マイ期限')).toBeInTheDocument();
        expect(screen.queryByText('納期')).not.toBeInTheDocument();
        const input = screen.getByPlaceholderText("YYYY/MM/DD or 'tomorrow'");
        input.focus();
        fireEvent.change(input, { target: { value: '2026/08/25' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onUpdateItem).toHaveBeenCalledWith('a', { prep_date: Math.floor(new Date(2026, 7, 25).getTime() / 1000) });
    });

    it('「連絡した」を押すとブロック内全アイテムのmeta.contacted_atが今日で保存される（既存metaは保持）', async () => {
        const onUpdateItem = vi.fn().mockResolvedValue(undefined);
        render(<OverduePanel groups={[buildGroup()]} today={TODAY} onUpdateItem={onUpdateItem} onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: '連絡した' }));
        await waitFor(() => expect(onUpdateItem).toHaveBeenCalledWith('b', { meta: { flow_x: 1, contacted_at: TODAY } }));
        expect(onUpdateItem).toHaveBeenCalledWith('a', { meta: { contacted_at: TODAY } });
    });

    it('連絡済みブロックは「連絡 M/d」を表示し、押すと取り消される（contacted_atだけ消える）', async () => {
        const onUpdateItem = vi.fn().mockResolvedValue(undefined);
        const group = buildGroup({
            contacted: true,
            contactedAt: '2026-08-17',
            items: [
                { id: 'a', title: 'タスクA', estimatedMinutes: 120, deadlineField: 'due_date', deadline: new Date('2026-08-10').getTime(), overdueDays: 8, meta: { contacted_at: '2026-08-17' } },
            ],
        });
        render(<OverduePanel groups={[group]} today={TODAY} onUpdateItem={onUpdateItem} onClose={vi.fn()} />);
        const toggleButton = screen.getByRole('button', { name: /連絡\s*8\/17/ });
        fireEvent.click(toggleButton);
        await waitFor(() => expect(onUpdateItem).toHaveBeenCalledWith('a', { meta: {} }));
    });

    it('50件のブロックでonUpdateItemが逐次呼び出しされる（前の呼び出しが完了する前に次を呼ばない）', async () => {
        const items = buildItems(50);
        const group = buildGroup({ items, totalMinutes: 3000, oldestOverdueDays: 8 });
        let resolveFirst: (() => void) | undefined;
        const onUpdateItem = vi.fn().mockImplementation((id: string) => {
            if (id === 'item-0') {
                return new Promise<void>((resolve) => { resolveFirst = resolve; });
            }
            return Promise.resolve();
        });
        render(<OverduePanel groups={[group]} today={TODAY} onUpdateItem={onUpdateItem} onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: '連絡した' }));

        await waitFor(() => expect(onUpdateItem).toHaveBeenCalledTimes(1));
        await new Promise((r) => setTimeout(r, 20));
        expect(onUpdateItem).toHaveBeenCalledTimes(1);

        resolveFirst?.();
        await waitFor(() => expect(onUpdateItem).toHaveBeenCalledTimes(50));
    });

    it('送信中はボタンが無効化され、n/N の進捗が表示される', async () => {
        const items = buildItems(3);
        const group = buildGroup({ items, totalMinutes: 180, oldestOverdueDays: 8 });
        let resolveFirst: (() => void) | undefined;
        const onUpdateItem = vi.fn().mockImplementation((id: string) => {
            if (id === 'item-0') {
                return new Promise<void>((resolve) => { resolveFirst = resolve; });
            }
            return Promise.resolve();
        });
        render(<OverduePanel groups={[group]} today={TODAY} onUpdateItem={onUpdateItem} onClose={vi.fn()} />);
        const button = screen.getByRole('button', { name: '連絡した' });
        fireEvent.click(button);

        await waitFor(() => expect(screen.getByRole('button', { name: '1/3' })).toBeDisabled());

        resolveFirst?.();
        await waitFor(() => expect(onUpdateItem).toHaveBeenCalledTimes(3));
    });

    it('途中1件が失敗しても残りは続行し、失敗件数が表示され、同じボタンで失敗分だけ再試行される', async () => {
        const items = buildItems(3);
        const group = buildGroup({ items, totalMinutes: 180, oldestOverdueDays: 8 });
        const onUpdateItem = vi.fn().mockImplementation((id: string) => {
            if (id === 'item-1') return Promise.reject(new Error('通信エラー'));
            return Promise.resolve();
        });
        render(<OverduePanel groups={[group]} today={TODAY} onUpdateItem={onUpdateItem} onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: '連絡した' }));

        await waitFor(() => expect(screen.getByRole('button', { name: '1件更新できませんでした' })).toBeInTheDocument());
        expect(onUpdateItem).toHaveBeenCalledTimes(3);

        onUpdateItem.mockClear();
        onUpdateItem.mockImplementation(() => Promise.resolve());
        fireEvent.click(screen.getByRole('button', { name: '1件更新できませんでした' }));

        await waitFor(() => expect(onUpdateItem).toHaveBeenCalledTimes(1));
        expect(onUpdateItem).toHaveBeenCalledWith('item-1', expect.anything());
    });

    it('「その他」（案件なし）ブロックには「連絡した」ボタンを出さない（納期入力は残す）', () => {
        const group = buildGroup({ projectId: null, groupTitle: 'その他' });
        render(<OverduePanel groups={[group]} today={TODAY} onUpdateItem={vi.fn()} onClose={vi.fn()} />);
        expect(screen.queryByRole('button', { name: '連絡した' })).not.toBeInTheDocument();
        expect(screen.getAllByPlaceholderText("YYYY/MM/DD or 'tomorrow'").length).toBe(2);
    });

    it('対象が0件でも見出しは表示する', () => {
        render(<OverduePanel groups={[]} today={TODAY} onUpdateItem={vi.fn()} onClose={vi.fn()} />);
        expect(screen.getByText(/期限超過\s*0件/)).toBeInTheDocument();
    });

    it('評価語を含まない（文言は事実のみ）', () => {
        render(<OverduePanel groups={[buildGroup()]} today={TODAY} onUpdateItem={vi.fn()} onClose={vi.fn()} />);
        const forbidden = ['やばい', '危険', 'ダメ', '大変', '要注意', '危機'];
        const text = document.body.textContent || '';
        forbidden.forEach(word => expect(text).not.toContain(word));
    });
});
