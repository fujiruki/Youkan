import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
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

const makeItem = (id: string, x: number, y: number): Item => ({
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
    meta: { flow_x: x, flow_y: y },
});

const itemA = makeItem('item-a', 100, 100);
const itemB = makeItem('item-b', 300, 100);

const mockGetAllItems = vi.fn().mockResolvedValue([itemA, itemB]);
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
        async getDependencies() { return []; }
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
    mockGetAllItems.mockResolvedValue([itemA, itemB]);
    mockUpdateItem.mockResolvedValue({ success: true });
});

const nodeOf = (id: string) => capturedProps.nodes.find((n: any) => n.id === id);

// R-108: 複数選択まとめ移動 → 選択解除で位置が元に戻るバグ
describe('FlowScreen: 複数選択まとめ移動後の位置保持（R-108）', () => {
    it('複数ノードをまとめて移動した後に選択解除しても、移動後の位置が保持される', async () => {
        renderFlowScreen();

        await waitFor(() => expect(mockGetAllItems).toHaveBeenCalled());
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());

        // 範囲選択（Shift+ドラッグ相当）で2ノードを選択
        act(() => {
            capturedProps.onNodesChange([
                { type: 'select', id: 'item-a', selected: true },
                { type: 'select', id: 'item-b', selected: true },
            ]);
        });
        act(() => {
            capturedProps.onSelectionChange({
                nodes: [{ id: 'item-a' }, { id: 'item-b' }],
                edges: [],
            });
        });

        const dragged = [
            { ...nodeOf('item-a'), position: { x: 150, y: 200 } },
            { ...nodeOf('item-b'), position: { x: 350, y: 200 } },
        ];

        // ドラッグ開始 → 移動 → xyflowの位置反映
        act(() => {
            capturedProps.onNodeDragStart({}, dragged[0], dragged);
            capturedProps.onNodeDrag({}, dragged[0], dragged);
        });
        act(() => {
            capturedProps.onNodesChange([
                { type: 'position', id: 'item-a', position: { x: 150, y: 200 }, dragging: true },
                { type: 'position', id: 'item-b', position: { x: 350, y: 200 }, dragging: true },
            ]);
        });

        await act(async () => {
            await capturedProps.onNodeDragStop({}, dragged[0], dragged);
        });
        act(() => {
            capturedProps.onNodesChange([
                { type: 'position', id: 'item-a', position: { x: 150, y: 200 }, dragging: false },
                { type: 'position', id: 'item-b', position: { x: 350, y: 200 }, dragging: false },
            ]);
        });

        expect(nodeOf('item-a').position).toEqual({ x: 150, y: 200 });
        expect(nodeOf('item-b').position).toEqual({ x: 350, y: 200 });

        // キャンバス空白をクリックして選択解除
        act(() => {
            capturedProps.onNodesChange([
                { type: 'select', id: 'item-a', selected: false },
                { type: 'select', id: 'item-b', selected: false },
            ]);
        });
        act(() => {
            capturedProps.onSelectionChange({ nodes: [], edges: [] });
        });

        await waitFor(() => {
            expect(nodeOf('item-a').position).toEqual({ x: 150, y: 200 });
            expect(nodeOf('item-b').position).toEqual({ x: 350, y: 200 });
        });
    });

    it('サーバー保存の完了前に選択解除しても、移動後の位置が保持される', async () => {
        // 実運用のネットワーク遅延を再現する（保存完了を手動で解決する）
        let resolveSave: (() => void)[] = [];
        mockUpdateItem.mockImplementation(
            () => new Promise<{ success: boolean }>((resolve) => {
                resolveSave.push(() => resolve({ success: true }));
            })
        );

        renderFlowScreen();

        await waitFor(() => expect(mockGetAllItems).toHaveBeenCalled());
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());

        act(() => {
            capturedProps.onNodesChange([
                { type: 'select', id: 'item-a', selected: true },
                { type: 'select', id: 'item-b', selected: true },
            ]);
        });
        act(() => {
            capturedProps.onSelectionChange({
                nodes: [{ id: 'item-a' }, { id: 'item-b' }],
                edges: [],
            });
        });

        const dragged = [
            { ...nodeOf('item-a'), position: { x: 150, y: 200 } },
            { ...nodeOf('item-b'), position: { x: 350, y: 200 } },
        ];

        act(() => {
            capturedProps.onNodeDragStart({}, dragged[0], dragged);
            capturedProps.onNodeDrag({}, dragged[0], dragged);
        });
        act(() => {
            capturedProps.onNodesChange([
                { type: 'position', id: 'item-a', position: { x: 150, y: 200 }, dragging: true },
                { type: 'position', id: 'item-b', position: { x: 350, y: 200 }, dragging: true },
            ]);
        });

        // 保存を待たずにドラッグ終了 → 保存はpendingのまま
        let dragStopPromise: Promise<void>;
        act(() => {
            dragStopPromise = capturedProps.onNodeDragStop({}, dragged[0], dragged);
        });
        act(() => {
            capturedProps.onNodesChange([
                { type: 'position', id: 'item-a', position: { x: 150, y: 200 }, dragging: false },
                { type: 'position', id: 'item-b', position: { x: 350, y: 200 }, dragging: false },
            ]);
        });

        // 保存完了前にキャンバス空白をクリックして選択解除
        act(() => {
            capturedProps.onNodesChange([
                { type: 'select', id: 'item-a', selected: false },
                { type: 'select', id: 'item-b', selected: false },
            ]);
        });
        act(() => {
            capturedProps.onSelectionChange({ nodes: [], edges: [] });
        });

        expect(nodeOf('item-a').position).toEqual({ x: 150, y: 200 });
        expect(nodeOf('item-b').position).toEqual({ x: 350, y: 200 });

        // 保存が順次完了しても位置は変わらない
        await act(async () => {
            for (let i = 0; i < 5; i++) {
                resolveSave.splice(0).forEach((r) => r());
                await new Promise((r) => setTimeout(r, 0));
            }
        });
        await dragStopPromise!;

        expect(mockUpdateItem).toHaveBeenCalledTimes(2);
        expect(nodeOf('item-a').position).toEqual({ x: 150, y: 200 });
        expect(nodeOf('item-b').position).toEqual({ x: 350, y: 200 });
    });
});
