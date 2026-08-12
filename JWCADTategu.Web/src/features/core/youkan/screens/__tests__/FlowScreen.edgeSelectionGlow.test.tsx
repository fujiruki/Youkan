import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { FilterProvider } from '../../contexts/FilterContext';
import { ToastProvider } from '../../../../../contexts/ToastContext';
import type { Item, Dependency } from '../../types';

// @xyflow/react の <ReactFlow> 本体だけをモックし、props（nodes/edges/各種ハンドラ）を捕捉する。
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

const childItem: Item = {
    id: 'item-child',
    title: '子アイテム',
    status: 'inbox',
    focusOrder: 0,
    isEngaged: false,
    statusUpdatedAt: 0,
    interrupt: false,
    weight: 1,
    createdAt: 0,
    updatedAt: 0,
    meta: { flow_x: 100, flow_y: 300 },
};

const existingDependency: Dependency = {
    id: 'dep-1',
    sourceItemId: 'item-parent',
    targetItemId: 'item-child',
    createdAt: Date.now(),
};

const mockGetAllItems = vi.fn().mockResolvedValue([parentItem, childItem]);
const mockGetDependencies = vi.fn().mockResolvedValue([existingDependency]);

vi.mock('../../../../../api/client', () => ({
    ApiClient: {
        getAllItems: (...args: unknown[]) => mockGetAllItems(...args),
        createItem: vi.fn(),
        updateItem: vi.fn().mockResolvedValue({ success: true }),
        deleteItem: vi.fn(),
        resolveDecision: vi.fn(),
    },
}));

vi.mock('../../repositories/DependencyRepository', () => ({
    DependencyRepository: class {
        async getDependencies(...args: unknown[]) { return mockGetDependencies(...args); }
        async createDependency() { return; }
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
    mockGetAllItems.mockResolvedValue([parentItem, childItem]);
    mockGetDependencies.mockResolvedValue([existingDependency]);
});

describe('FlowScreen: エッジ選択時の視覚的フィードバック（グロー表現）', () => {
    it('エッジ選択時にstyleへ発光表現（filter: drop-shadow）が付与される', async () => {
        renderFlowScreen();

        await waitFor(() => expect(mockGetAllItems).toHaveBeenCalled());
        await waitFor(() => {
            expect(capturedProps?.edges?.some((e: any) => e.id === 'dep-1')).toBe(true);
        });

        const beforeEdge = capturedProps.edges.find((e: any) => e.id === 'dep-1');
        expect(beforeEdge.selected).not.toBe(true);
        expect(beforeEdge.style?.filter).toBeUndefined();

        act(() => {
            capturedProps.onSelectionChange({ nodes: [], edges: [{ id: 'dep-1' }] });
        });

        await waitFor(() => {
            const selectedEdge = capturedProps.edges.find((e: any) => e.id === 'dep-1');
            expect(selectedEdge.selected).toBe(true);
            expect(selectedEdge.style?.filter).toEqual(expect.stringContaining('drop-shadow'));
        });
    });

    it('選択解除するとグロー表現が消える', async () => {
        renderFlowScreen();

        await waitFor(() => expect(mockGetAllItems).toHaveBeenCalled());
        await waitFor(() => {
            expect(capturedProps?.edges?.some((e: any) => e.id === 'dep-1')).toBe(true);
        });

        act(() => {
            capturedProps.onSelectionChange({ nodes: [], edges: [{ id: 'dep-1' }] });
        });
        await waitFor(() => {
            const selectedEdge = capturedProps.edges.find((e: any) => e.id === 'dep-1');
            expect(selectedEdge.style?.filter).toEqual(expect.stringContaining('drop-shadow'));
        });

        act(() => {
            capturedProps.onSelectionChange({ nodes: [], edges: [] });
        });

        await waitFor(() => {
            const deselectedEdge = capturedProps.edges.find((e: any) => e.id === 'dep-1');
            expect(deselectedEdge.selected).not.toBe(true);
            expect(deselectedEdge.style?.filter).toBeUndefined();
        });
    });
});
