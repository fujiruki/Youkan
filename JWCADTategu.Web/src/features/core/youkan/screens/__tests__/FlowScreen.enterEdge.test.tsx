import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, fireEvent, waitFor } from '@testing-library/react';
import { FilterProvider } from '../../contexts/FilterContext';
import { ToastProvider } from '../../../../../contexts/ToastContext';
import type { Item, Dependency } from '../../types';

// @xyflow/react の <ReactFlow> 本体だけをモックし、props（nodes/edges/各種ハンドラ）を捕捉する。
// ReactFlowProvider・useReactFlow・useNodesState・useEdgesState・addEdge・MarkerType は実装のまま使う。
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

const parentItem: Item = {
    id: 'item-parent',
    title: '親アイテム',
    status: 'inbox',
    focusOrder: 0,
    isEngaged: false,
    statusUpdatedAt: 0,
    interrupt: false,
    weight: 1,
    createdAt: 0,
    updatedAt: 0,
    meta: { flow_x: 100, flow_y: 100 },
};

const newDependency: Dependency = {
    id: 'dep-1',
    sourceItemId: 'item-parent',
    targetItemId: 'item-child',
    createdAt: Date.now(),
};

const mockGetAllItems = vi.fn().mockResolvedValue([parentItem]);
const mockCreateItem = vi.fn().mockResolvedValue({ id: 'item-child', success: true });
const mockUpdateItem = vi.fn().mockResolvedValue({ success: true });
const mockCreateDependency = vi.fn().mockResolvedValue(newDependency);

vi.mock('../../../../../api/client', () => ({
    ApiClient: {
        getAllItems: (...args: unknown[]) => mockGetAllItems(...args),
        createItem: (...args: unknown[]) => mockCreateItem(...args),
        updateItem: (...args: unknown[]) => mockUpdateItem(...args),
        deleteItem: vi.fn(),
        resolveDecision: vi.fn(),
    },
}));

vi.mock('../../repositories/DependencyRepository', () => ({
    DependencyRepository: class {
        async getDependencies() { return []; }
        async createDependency(...args: unknown[]) { return mockCreateDependency(...args); }
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
    mockGetAllItems.mockResolvedValue([parentItem]);
    mockCreateItem.mockResolvedValue({ id: 'item-child', success: true });
    mockUpdateItem.mockResolvedValue({ success: true });
    mockCreateDependency.mockResolvedValue(newDependency);
});

describe('FlowScreen: Enterキーによる新規ノード追加時の接続線描画', () => {
    it('通常操作では新規ノード作成で依存関係のedgeが描画される', async () => {
        const { getByTestId } = renderFlowScreen();

        await waitFor(() => expect(mockGetAllItems).toHaveBeenCalled());
        await waitFor(() => expect(capturedProps?.nodes?.some((n: any) => n.id === 'item-parent')).toBe(true));

        act(() => {
            capturedProps.onSelectionChange({ nodes: [{ id: 'item-parent' }], edges: [] });
        });

        const wrapper = getByTestId('flow-canvas-root');
        await act(async () => {
            fireEvent.keyDown(wrapper, { key: 'Enter' });
            // createNodeBelow 内の await チェーンを流し切る
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
        });

        await waitFor(() => {
            expect(capturedProps.edges).toEqual(
                expect.arrayContaining([expect.objectContaining({ id: 'dep-1', source: 'item-parent', target: 'item-child' })])
            );
        });
    });

    it('ノードドラッグ中（isDragging=true）に新規ノードを作成しても接続線が描画される', async () => {
        // 実際に報告されたバグの根本原因: 依存関係作成パス（createNodeBelow等）は
        // setDependencies のみを呼び、edges の再構築を「isDragging中は丸ごとスキップする」
        // 派生useEffectに一任していた。ドラッグ操作の非同期テールとキー操作が重なると
        // dependencies は正しく更新されても edges に反映されないまま取り残される。
        const { getByTestId } = renderFlowScreen();

        await waitFor(() => expect(mockGetAllItems).toHaveBeenCalled());
        await waitFor(() => expect(capturedProps?.nodes?.some((n: any) => n.id === 'item-parent')).toBe(true));

        act(() => {
            capturedProps.onSelectionChange({ nodes: [{ id: 'item-parent' }], edges: [] });
        });

        // ドラッグ開始のみ発火させ、ドラッグ終了は発火させない
        // （isDragging.current が true のまま新規ノード作成が走るケースを再現）
        act(() => {
            capturedProps.onNodeDragStart(
                {},
                { id: 'item-parent', position: { x: 100, y: 100 } },
                [{ id: 'item-parent', position: { x: 100, y: 100 } }]
            );
        });

        const wrapper = getByTestId('flow-canvas-root');
        await act(async () => {
            fireEvent.keyDown(wrapper, { key: 'Enter' });
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
        });

        await waitFor(() => {
            expect(capturedProps.edges).toEqual(
                expect.arrayContaining([expect.objectContaining({ id: 'dep-1', source: 'item-parent', target: 'item-child' })])
            );
        });
    });

    it('新規作成されるedgeはアニメーションなし・矢印マーカー付きで描画される', async () => {
        const { getByTestId } = renderFlowScreen();

        await waitFor(() => expect(mockGetAllItems).toHaveBeenCalled());
        await waitFor(() => expect(capturedProps?.nodes?.some((n: any) => n.id === 'item-parent')).toBe(true));

        act(() => {
            capturedProps.onSelectionChange({ nodes: [{ id: 'item-parent' }], edges: [] });
        });

        const wrapper = getByTestId('flow-canvas-root');
        await act(async () => {
            fireEvent.keyDown(wrapper, { key: 'Enter' });
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
        });

        await waitFor(() => {
            const edge = capturedProps.edges.find((e: any) => e.id === 'dep-1');
            expect(edge).toBeDefined();
            expect(edge.animated).toBe(false);
            expect(edge.markerEnd).toEqual(expect.objectContaining({ type: 'arrowclosed' }));
        });
    });
});
