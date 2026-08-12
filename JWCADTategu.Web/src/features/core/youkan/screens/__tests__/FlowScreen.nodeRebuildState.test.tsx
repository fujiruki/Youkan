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

// R-080調査で判明した関連不具合（docs/handover/R-077-analysis.md「今回スコープ外として残した関連不具合」2.）:
// ノード作成・編集のたびに、派生useEffectがitemNodesを丸ごと再構築し、
// xyflowが内部管理するmeasured(計測済みサイズ)・selected(選択状態)を引き継がず消してしまう。
// measuredが消えると新規ノードがvisibility:hiddenに固定され続け、フォーカス・全選択が効かない（R-080の一因）。
describe('FlowScreen: ノード再構築時のxyflow内部状態(selected)保持', () => {
    it('依存関係作成によるノード再構築後も、既存ノードのselected状態が保持される', async () => {
        const { getByTestId } = renderFlowScreen();

        await waitFor(() => expect(mockGetAllItems).toHaveBeenCalled());
        await waitFor(() => expect(capturedProps?.nodes?.some((n: any) => n.id === 'item-parent')).toBe(true));

        // xyflow内部のクリック選択と同じ経路（onNodesChangeのselect変更）でselected状態を作る
        act(() => {
            capturedProps.onNodesChange([{ type: 'select', id: 'item-parent', selected: true }]);
        });
        act(() => {
            capturedProps.onSelectionChange({ nodes: [{ id: 'item-parent' }], edges: [] });
        });

        await waitFor(() => {
            const parentNode = capturedProps.nodes.find((n: any) => n.id === 'item-parent');
            expect(parentNode.selected).toBe(true);
        });

        // Enterキーで新規ノード＋依存関係を作成し、dependencies変更による派生useEffectの再構築を発火させる
        const wrapper = getByTestId('flow-canvas-root');
        await act(async () => {
            fireEvent.keyDown(wrapper, { key: 'Enter' });
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
        });

        await waitFor(() => {
            expect(capturedProps.edges).toEqual(
                expect.arrayContaining([expect.objectContaining({ id: 'dep-1' })])
            );
        });

        const parentNodeAfterRebuild = capturedProps.nodes.find((n: any) => n.id === 'item-parent');
        expect(parentNodeAfterRebuild.selected).toBe(true);
    });
});
