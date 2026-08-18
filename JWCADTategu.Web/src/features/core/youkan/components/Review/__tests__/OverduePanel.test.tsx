import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { OverduePanel } from '../OverduePanel';
import { OverdueGroup } from '../../../logic/overdueGroups';

const TODAY = '2026-08-18';

const buildGroup = (overrides: Partial<OverdueGroup> = {}): OverdueGroup => ({
    projectId: 'p1',
    groupTitle: '田中様／玄関建具',
    items: [
        { id: 'a', title: 'タスクA', estimatedMinutes: 120, dueDate: '2026-08-10', deadline: new Date('2026-08-10').getTime(), overdueDays: 8, meta: null },
        { id: 'b', title: 'タスクB', estimatedMinutes: 60, dueDate: '2026-08-16', deadline: new Date('2026-08-16').getTime(), overdueDays: 2, meta: { flow_x: 1 } },
    ],
    totalMinutes: 180,
    oldestOverdueDays: 8,
    contacted: false,
    contactedAt: null,
    ...overrides,
});

describe('OverduePanel (R-136 / F-55)', () => {
    it('見出しに件数と合計hを表示する', () => {
        render(<OverduePanel groups={[buildGroup()]} today={TODAY} onUpdateItem={vi.fn()} onClose={vi.fn()} />);
        expect(screen.getByText(/超過分\s*2件/)).toBeInTheDocument();
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
    });

    it('「連絡した」を押すとブロック内全アイテムのmeta.contacted_atが今日で保存される（既存metaは保持）', () => {
        const onUpdateItem = vi.fn();
        render(<OverduePanel groups={[buildGroup()]} today={TODAY} onUpdateItem={onUpdateItem} onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: '連絡した' }));
        expect(onUpdateItem).toHaveBeenCalledWith('a', { meta: { contacted_at: TODAY } });
        expect(onUpdateItem).toHaveBeenCalledWith('b', { meta: { flow_x: 1, contacted_at: TODAY } });
    });

    it('連絡済みブロックは「連絡 M/d」を表示し、押すと取り消される（contacted_atだけ消える）', () => {
        const onUpdateItem = vi.fn();
        const group = buildGroup({
            contacted: true,
            contactedAt: '2026-08-17',
            items: [
                { id: 'a', title: 'タスクA', estimatedMinutes: 120, dueDate: '2026-08-10', deadline: new Date('2026-08-10').getTime(), overdueDays: 8, meta: { contacted_at: '2026-08-17' } },
            ],
        });
        render(<OverduePanel groups={[group]} today={TODAY} onUpdateItem={onUpdateItem} onClose={vi.fn()} />);
        const toggleButton = screen.getByRole('button', { name: /連絡\s*8\/17/ });
        fireEvent.click(toggleButton);
        expect(onUpdateItem).toHaveBeenCalledWith('a', { meta: {} });
    });

    it('対象が0件でも見出しは表示する', () => {
        render(<OverduePanel groups={[]} today={TODAY} onUpdateItem={vi.fn()} onClose={vi.fn()} />);
        expect(screen.getByText(/超過分\s*0件/)).toBeInTheDocument();
    });

    it('評価語を含まない（文言は事実のみ）', () => {
        render(<OverduePanel groups={[buildGroup()]} today={TODAY} onUpdateItem={vi.fn()} onClose={vi.fn()} />);
        const forbidden = ['やばい', '危険', 'ダメ', '大変', '要注意', '危機'];
        const text = document.body.textContent || '';
        forbidden.forEach(word => expect(text).not.toContain(word));
    });
});
