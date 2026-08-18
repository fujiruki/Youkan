import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { addDays, parseISO } from 'date-fns';
import { ReviewSweep } from '../ReviewSweep';
import { Item, JudgmentStatus } from '../../../types';

const TODAY = '2026-08-18';

const createItem = (id: string, status: JudgmentStatus, overrides: Partial<Item> = {}): Item => ({
    id,
    title: `タスク${id}`,
    status,
    focusOrder: 0,
    isEngaged: false,
    statusUpdatedAt: 0,
    interrupt: false,
    weight: 1,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
});

describe('ReviewSweep', () => {
    it('先頭アイテムのタイトルを表示する', () => {
        const items = [createItem('1', 'inbox', { due_date: '2026-08-10' })];
        render(
            <ReviewSweep
                items={items}
                today={TODAY}
                judgmentPhrases={[]}
                declinedThisWeek={0}
                onDecision={vi.fn()}
                onOpenDetail={vi.fn()}
                onClose={vi.fn()}
            />
        );
        expect(screen.getByText('タスク1')).toBeInTheDocument();
    });

    it('[1] 今日やる をクリックすると onDecision(id, "yes") が呼ばれる', () => {
        const items = [createItem('1', 'inbox', { due_date: '2026-08-10' })];
        const onDecision = vi.fn();
        render(
            <ReviewSweep
                items={items}
                today={TODAY}
                judgmentPhrases={[]}
                declinedThisWeek={0}
                onDecision={onDecision}
                onOpenDetail={vi.fn()}
                onClose={vi.fn()}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /今日やる/ }));
        expect(onDecision).toHaveBeenCalledWith('1', 'yes', undefined, undefined);
    });

    it('数字キー "1" でも今日やる判断が発火する', () => {
        const items = [createItem('1', 'inbox', { due_date: '2026-08-10' })];
        const onDecision = vi.fn();
        render(
            <ReviewSweep
                items={items}
                today={TODAY}
                judgmentPhrases={[]}
                declinedThisWeek={0}
                onDecision={onDecision}
                onOpenDetail={vi.fn()}
                onClose={vi.fn()}
            />
        );
        fireEvent.keyDown(window, { key: '1' });
        expect(onDecision).toHaveBeenCalledWith('1', 'yes', undefined, undefined);
    });

    it('[2] 後日 をクリックすると既定の今日+7日でonDecision(id,"later")が呼ばれる', () => {
        const items = [createItem('1', 'inbox', { due_date: '2026-08-10' })];
        const onDecision = vi.fn();
        render(
            <ReviewSweep
                items={items}
                today={TODAY}
                judgmentPhrases={[]}
                declinedThisWeek={0}
                onDecision={onDecision}
                onOpenDetail={vi.fn()}
                onClose={vi.fn()}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /後日/ }));
        const expectedUnix = Math.floor(addDays(parseISO(TODAY), 7).getTime() / 1000);
        expect(onDecision).toHaveBeenCalledWith('1', 'later', undefined, { prep_date: expectedUnix });
    });

    it('[3] 断った をクリックすると onDecision(id,"no", undefined, {meta:{declined:true}}) が呼ばれる', () => {
        const items = [createItem('1', 'inbox', { due_date: '2026-08-10', meta: { flow_x: 1 } })];
        const onDecision = vi.fn();
        render(
            <ReviewSweep
                items={items}
                today={TODAY}
                judgmentPhrases={[]}
                declinedThisWeek={0}
                onDecision={onDecision}
                onOpenDetail={vi.fn()}
                onClose={vi.fn()}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /断った/ }));
        expect(onDecision).toHaveBeenCalledWith('1', 'no', undefined, { meta: { flow_x: 1, declined: true } });
    });

    it('飛ばすを押しても onDecision は呼ばれず次のアイテムに進む', () => {
        const items = [
            createItem('1', 'inbox', { due_date: '2026-08-10' }),
            createItem('2', 'inbox', { due_date: '2026-08-11' }),
        ];
        const onDecision = vi.fn();
        render(
            <ReviewSweep
                items={items}
                today={TODAY}
                judgmentPhrases={[]}
                declinedThisWeek={0}
                onDecision={onDecision}
                onOpenDetail={vi.fn()}
                onClose={vi.fn()}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: '飛ばす' }));
        expect(onDecision).not.toHaveBeenCalled();
        expect(screen.getByText('タスク2')).toBeInTheDocument();
    });

    it('3件判断すると完了ビューを表示する（残り件数・今週断った件数）', () => {
        const items = [
            createItem('1', 'inbox', { due_date: '2026-08-10' }),
            createItem('2', 'inbox', { due_date: '2026-08-11' }),
            createItem('3', 'inbox', { due_date: '2026-08-12' }),
        ];
        render(
            <ReviewSweep
                items={items}
                today={TODAY}
                judgmentPhrases={[]}
                declinedThisWeek={2}
                onDecision={vi.fn()}
                onOpenDetail={vi.fn()}
                onClose={vi.fn()}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /今日やる/ }));
        fireEvent.click(screen.getByRole('button', { name: /今日やる/ }));
        fireEvent.click(screen.getByRole('button', { name: /今日やる/ }));

        expect(screen.getByText(/今日はここまで/)).toBeInTheDocument();
        expect(screen.getByText(/残り\s*0\s*件/)).toBeInTheDocument();
        expect(screen.getByText(/今週\s*断った\s*2\s*件/)).toBeInTheDocument();
    });

    it('完了ビューの「あと3件」を押すと通常表示に戻る', () => {
        const items = [
            createItem('1', 'inbox', { due_date: '2026-08-10' }),
            createItem('2', 'inbox', { due_date: '2026-08-11' }),
            createItem('3', 'inbox', { due_date: '2026-08-12' }),
            createItem('4', 'inbox', { due_date: '2026-08-13' }),
        ];
        render(
            <ReviewSweep
                items={items}
                today={TODAY}
                judgmentPhrases={[]}
                declinedThisWeek={0}
                onDecision={vi.fn()}
                onOpenDetail={vi.fn()}
                onClose={vi.fn()}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /今日やる/ }));
        fireEvent.click(screen.getByRole('button', { name: /今日やる/ }));
        fireEvent.click(screen.getByRole('button', { name: /今日やる/ }));
        expect(screen.getByText(/今日はここまで/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'あと3件' }));
        expect(screen.getByText('タスク4')).toBeInTheDocument();
    });

    it('完了ビューの「閉じる」で onClose が呼ばれる', () => {
        const items = [
            createItem('1', 'inbox', { due_date: '2026-08-10' }),
            createItem('2', 'inbox', { due_date: '2026-08-11' }),
            createItem('3', 'inbox', { due_date: '2026-08-12' }),
        ];
        const onClose = vi.fn();
        render(
            <ReviewSweep
                items={items}
                today={TODAY}
                judgmentPhrases={[]}
                declinedThisWeek={0}
                onDecision={vi.fn()}
                onOpenDetail={vi.fn()}
                onClose={onClose}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /今日やる/ }));
        fireEvent.click(screen.getByRole('button', { name: /今日やる/ }));
        fireEvent.click(screen.getByRole('button', { name: /今日やる/ }));
        fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
        expect(onClose).toHaveBeenCalled();
    });

    it('Escキーでいつでも onClose が呼ばれる', () => {
        const items = [createItem('1', 'inbox', { due_date: '2026-08-10' })];
        const onClose = vi.fn();
        render(
            <ReviewSweep
                items={items}
                today={TODAY}
                judgmentPhrases={[]}
                declinedThisWeek={0}
                onDecision={vi.fn()}
                onOpenDetail={vi.fn()}
                onClose={onClose}
            />
        );
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
    });

    it('判断の言葉が渡されていれば表示する', () => {
        const items = [createItem('1', 'inbox', { due_date: '2026-08-10' })];
        render(
            <ReviewSweep
                items={items}
                today={TODAY}
                judgmentPhrases={['正しさより速さが正義']}
                declinedThisWeek={0}
                onDecision={vi.fn()}
                onOpenDetail={vi.fn()}
                onClose={vi.fn()}
            />
        );
        expect(screen.getByText('正しさより速さが正義')).toBeInTheDocument();
    });

    it('判断の言葉が空なら何も表示しない', () => {
        const items = [createItem('1', 'inbox', { due_date: '2026-08-10' })];
        render(
            <ReviewSweep
                items={items}
                today={TODAY}
                judgmentPhrases={[]}
                declinedThisWeek={0}
                onDecision={vi.fn()}
                onOpenDetail={vi.fn()}
                onClose={vi.fn()}
            />
        );
        expect(screen.queryByTestId('review-sweep-phrase')).toBeNull();
    });

    it('詳細を開くをクリックすると onOpenDetail(item) が呼ばれる', () => {
        const items = [createItem('1', 'inbox', { due_date: '2026-08-10' })];
        const onOpenDetail = vi.fn();
        render(
            <ReviewSweep
                items={items}
                today={TODAY}
                judgmentPhrases={[]}
                declinedThisWeek={0}
                onDecision={vi.fn()}
                onOpenDetail={onOpenDetail}
                onClose={vi.fn()}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: '詳細を開く' }));
        expect(onOpenDetail).toHaveBeenCalledWith(items[0]);
    });
});
