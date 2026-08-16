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

const makeItem = (id: string, dueDate: string | null, minutes: number, x: number, y: number): Item => ({
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
    meta: { flow_x: x, flow_y: y },
});

const itemA = makeItem('item-a', null, 60, 0, 0);
const itemB = makeItem('item-b', null, 120, 100, 0);
const itemC = makeItem('item-c', null, 60, 0, 200);

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

const clickButton = async (name: string) => {
    const user = userEvent.setup();
    await act(async () => {
        await user.click(screen.getByRole('button', { name }));
    });
};

// R-112: フロー「自動整理」ボタン
describe('FlowScreen: 自動整理ボタン（R-112）', () => {
    it('「自動整理」ボタンが表示される', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());
        expect(screen.getByRole('button', { name: '自動整理' })).toBeInTheDocument();
    });

    it('押下すると位置が更新され、サーバーにも保存される', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());
        // item-bはitem-aに依存する下位層のため、自動整理で必ず位置が変わる
        const beforeB = nodeOf('item-b').position;

        await clickButton('自動整理');

        await waitFor(() => {
            expect(nodeOf('item-b').position).not.toEqual(beforeB);
        });
        await waitFor(() => expect(mockUpdateItem).toHaveBeenCalledTimes(3));
        const savedB = mockUpdateItem.mock.calls.find((c) => c[0] === 'item-b')![1];
        expect(savedB.meta.flow_x).toBe(nodeOf('item-b').position.x);
        expect(savedB.meta.flow_y).toBe(nodeOf('item-b').position.y);
    });

    it('「元に戻す」で自動整理適用前の位置へ復元される', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-b')).toBeTruthy());
        expect(nodeOf('item-b').position).toEqual({ x: 100, y: 0 });

        await clickButton('自動整理');
        await waitFor(() => expect(nodeOf('item-b').position).not.toEqual({ x: 100, y: 0 }));

        await clickButton('元に戻す');

        await waitFor(() => {
            expect(nodeOf('item-a').position).toEqual({ x: 0, y: 0 });
            expect(nodeOf('item-b').position).toEqual({ x: 100, y: 0 });
            expect(nodeOf('item-c').position).toEqual({ x: 0, y: 200 });
        });
    });

    it('日付表示チェックON中は自動整理ボタンが無効化される', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());

        const user = userEvent.setup();
        await act(async () => {
            await user.click(screen.getByRole('checkbox', { name: '日付表示' }));
        });

        await waitFor(() => expect(screen.getByRole('button', { name: '自動整理' })).toBeDisabled());
    });
});
