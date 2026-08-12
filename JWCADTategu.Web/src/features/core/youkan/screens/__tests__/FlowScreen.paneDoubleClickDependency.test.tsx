import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { FilterProvider } from '../../contexts/FilterContext';
import { ToastProvider } from '../../../../../contexts/ToastContext';
import type { Item, Dependency } from '../../types';

// R-088: 空白部ダブルクリック時、選択ノードとクリック位置の上下関係に応じて
// 依存関係を自動設定する。screenToFlowPosition は実装の座標変換ロジックを
// テストの関心事から切り離すため、clientX/clientY をそのまま流す恒等写像にモックする。
// screenToFlowPosition/fitView はモジュールスコープの安定参照にすること
// （useReactFlow() の戻り値オブジェクトを毎回new生成すると、FlowScreen側の
// useEffect/useCallback依存配列がレンダーごとに変化し続け、setNodesが無限に
// 再実行される無限レンダーループでheap out of memoryを起こす）。
let capturedProps: any = null;
const mockScreenToFlowPosition = ({ x, y }: { x: number; y: number }) => ({ x, y });
const mockFitView = vi.fn();

vi.mock('@xyflow/react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@xyflow/react')>();
    return {
        ...actual,
        ReactFlow: (props: any) => {
            capturedProps = props;
            return <div data-testid="mock-reactflow" />;
        },
        useReactFlow: () => ({
            screenToFlowPosition: mockScreenToFlowPosition,
            fitView: mockFitView,
        }),
    };
});

const selectedItem: Item = {
    id: 'item-selected',
    title: '選択中アイテム',
    status: 'inbox',
    focusOrder: 0,
    isEngaged: false,
    statusUpdatedAt: 0,
    interrupt: false,
    weight: 1,
    createdAt: 0,
    updatedAt: 0,
    meta: { flow_x: 100, flow_y: 200 },
};

const newDependency: Dependency = {
    id: 'dep-1',
    sourceItemId: 'item-selected',
    targetItemId: 'item-child',
    createdAt: Date.now(),
};

const mockGetAllItems = vi.fn().mockResolvedValue([selectedItem]);
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

const selectItem = () => {
    act(() => {
        capturedProps.onSelectionChange({ nodes: [{ id: 'item-selected' }], edges: [] });
    });
};

const flushAwaitChain = async () => {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    });
};

beforeEach(() => {
    capturedProps = null;
    vi.clearAllMocks();
    mockGetAllItems.mockResolvedValue([selectedItem]);
    mockCreateItem.mockResolvedValue({ id: 'item-child', success: true });
    mockUpdateItem.mockResolvedValue({ success: true });
    mockCreateDependency.mockResolvedValue(newDependency);
});

describe('FlowScreen: 空白部ダブルクリックの依存関係自動設定（R-088）', () => {
    it('選択ノードがあり、クリック位置が選択ノードより上の場合、新規ノード→選択ノードの依存関係を作成する', async () => {
        renderFlowScreen();
        await waitFor(() => expect(mockGetAllItems).toHaveBeenCalled());
        await waitFor(() => expect(capturedProps?.nodes?.some((n: any) => n.id === 'item-selected')).toBe(true));

        selectItem();

        // 選択ノードの flow_y=200 より上（y座標が小さい）でダブルクリック
        await act(async () => {
            await capturedProps.onDoubleClick({ clientX: 100, clientY: 50 });
        });
        await flushAwaitChain();

        expect(mockCreateDependency).toHaveBeenCalledWith('item-child', 'item-selected');

        await waitFor(() => {
            expect(capturedProps.edges).toEqual(
                expect.arrayContaining([expect.objectContaining({ id: 'dep-1', source: 'item-selected', target: 'item-child' })])
            );
        });
    });

    it('選択ノードがあり、クリック位置が選択ノードより下の場合、選択ノード→新規ノードの依存関係を作成する', async () => {
        renderFlowScreen();
        await waitFor(() => expect(mockGetAllItems).toHaveBeenCalled());
        await waitFor(() => expect(capturedProps?.nodes?.some((n: any) => n.id === 'item-selected')).toBe(true));

        selectItem();

        // 選択ノードの flow_y=200 より下（y座標が大きい）でダブルクリック
        await act(async () => {
            await capturedProps.onDoubleClick({ clientX: 100, clientY: 350 });
        });
        await flushAwaitChain();

        expect(mockCreateDependency).toHaveBeenCalledWith('item-selected', 'item-child');

        await waitFor(() => {
            expect(capturedProps.edges).toEqual(
                expect.arrayContaining([expect.objectContaining({ id: 'dep-1', source: 'item-selected', target: 'item-child' })])
            );
        });
    });

    it('選択ノードがない場合、依存関係を作成せず新規ノードのみ作成する（現状維持）', async () => {
        renderFlowScreen();
        await waitFor(() => expect(mockGetAllItems).toHaveBeenCalled());
        await waitFor(() => expect(capturedProps?.nodes?.some((n: any) => n.id === 'item-selected')).toBe(true));

        // 選択ノードなしの状態でダブルクリック
        await act(async () => {
            await capturedProps.onDoubleClick({ clientX: 100, clientY: 50 });
        });
        await flushAwaitChain();

        expect(mockCreateItem).toHaveBeenCalled();
        expect(mockCreateDependency).not.toHaveBeenCalled();
    });
});
