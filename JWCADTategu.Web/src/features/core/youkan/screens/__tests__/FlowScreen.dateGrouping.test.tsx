import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterProvider } from '../../contexts/FilterContext';
import { ToastProvider } from '../../../../../contexts/ToastContext';
import type { Item } from '../../types';

let capturedProps: any = null;

vi.mock('@xyflow/react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@xyflow/react')>();
    return {
        ...actual,
        ReactFlow: (props: any) => {
            capturedProps = props;
            return <div data-testid="mock-reactflow" />;
        },
    };
});

const makeItem = (id: string, dueDate: string | null, minutes: number, y: number): Item => ({
    id,
    title: id,
    status: 'inbox',
    focusOrder: 0,
    isEngaged: false,
    statusUpdatedAt: 0,
    interrupt: false,
    weight: 1,
    createdAt: 0,
    updatedAt: 0,
    due_date: dueDate,
    estimatedMinutes: minutes,
    meta: { flow_x: 0, flow_y: y },
});

// 8/16締切: a(1h) → b(2h) の直列 / 8/17締切: c(1h)
const itemA = makeItem('item-a', '2026-08-16', 60, 300);
const itemB = makeItem('item-b', '2026-08-16', 120, 100);
const itemC = makeItem('item-c', '2026-08-17', 60, 0);

const mockGetAllItems = vi.fn().mockResolvedValue([itemA, itemB, itemC]);
const mockUpdateItem = vi.fn().mockResolvedValue({ success: true });

vi.mock('../../../../../api/client', () => ({
    ApiClient: {
        getAllItems: (...args: unknown[]) => mockGetAllItems(...args),
        createItem: vi.fn(),
        updateItem: (...args: unknown[]) => mockUpdateItem(...args),
        deleteItem: vi.fn(),
        resolveDecision: vi.fn(),
    },
}));

vi.mock('../../repositories/DependencyRepository', () => ({
    DependencyRepository: class {
        async getDependencies() {
            return [{ id: 'dep-1', sourceItemId: 'item-a', targetItemId: 'item-b', createdAt: 0 }];
        }
        async createDependency() { return null; }
        async deleteDependency() { return; }
    },
}));

import { FlowScreen } from '../FlowScreen';

const renderFlowScreen = () =>
    render(
        <FilterProvider>
            <ToastProvider>
                <FlowScreen initialProjectId="__all__" />
            </ToastProvider>
        </FilterProvider>
    );

beforeEach(() => {
    capturedProps = null;
    vi.clearAllMocks();
    mockGetAllItems.mockResolvedValue([itemA, itemB, itemC]);
    mockUpdateItem.mockResolvedValue({ success: true });
});

const nodeOf = (id: string) => capturedProps.nodes.find((n: any) => n.id === id);
const bandNodes = () => capturedProps.nodes.filter((n: any) => n.type === 'dateBand');

const toggleDateGrouping = async () => {
    const user = userEvent.setup();
    await act(async () => {
        await user.click(screen.getByRole('checkbox', { name: '日付表示' }));
    });
};

// R-109: フローチャート日付グルーピング表示
describe('FlowScreen: 日付グルーピング表示（R-109）', () => {
    it('「日付表示」チェックボックスが表示され、初期状態はOFF', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());

        const checkbox = screen.getByRole('checkbox', { name: '日付表示' });
        expect(checkbox).not.toBeChecked();
        expect(bandNodes()).toHaveLength(0);
        expect(screen.queryByRole('button', { name: '元に戻す' })).toBeNull();
    });

    it('チェックONで日付区間の帯が合計時間・最短時間つきで表示される', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());

        await toggleDateGrouping();

        await waitFor(() => expect(bandNodes()).toHaveLength(2));
        const [first, second] = bandNodes();
        // 2026-08-16は日曜日、2026-08-17は月曜日
        expect(first.data.label).toBe('8/16(日)まで');
        expect(first.data.totalMinutes).toBe(180);
        expect(first.data.criticalMinutes).toBe(180);
        expect(second.data.label).toBe('8/17(月)まで');
        expect(second.data.totalMinutes).toBe(60);
        expect(second.position.y).toBeGreaterThan(first.position.y);
    });

    it('チェックONでノードの位置が日付グルーピング配置へ更新され、サーバーにも保存される', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());

        await toggleDateGrouping();

        await waitFor(() => {
            // 8/16のa,bは同じ行（帯）、依存順にa→bで左から右に並ぶ
            expect(nodeOf('item-a').position.y).toBe(nodeOf('item-b').position.y);
            expect(nodeOf('item-a').position.x).toBeLessThan(nodeOf('item-b').position.x);
            // 8/17のcは次の帯（下）
            expect(nodeOf('item-c').position.y).toBeGreaterThan(nodeOf('item-a').position.y);
        });

        await waitFor(() => expect(mockUpdateItem).toHaveBeenCalledTimes(3));
        const savedA = mockUpdateItem.mock.calls.find((c) => c[0] === 'item-a')![1];
        expect(savedA.meta.flow_x).toBe(nodeOf('item-a').position.x);
        expect(savedA.meta.flow_y).toBe(nodeOf('item-a').position.y);
    });

    it('「元に戻す」でチェックON直前の位置へ復元される', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());
        expect(nodeOf('item-a').position).toEqual({ x: 0, y: 300 });

        await toggleDateGrouping();
        await waitFor(() => expect(nodeOf('item-a').position.y).not.toBe(300));

        const user = userEvent.setup();
        await act(async () => {
            await user.click(screen.getByRole('button', { name: '元に戻す' }));
        });

        await waitFor(() => {
            expect(nodeOf('item-a').position).toEqual({ x: 0, y: 300 });
            expect(nodeOf('item-b').position).toEqual({ x: 0, y: 100 });
            expect(nodeOf('item-c').position).toEqual({ x: 0, y: 0 });
        });
        expect(bandNodes()).toHaveLength(0);
    });
});
