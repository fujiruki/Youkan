import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { FilterProvider } from '../../contexts/FilterContext';
import { ToastProvider } from '../../../../../contexts/ToastContext';
import type { Item } from '../../types';

// @xyflow/react の <ReactFlow> 本体と useReactFlow() の fitView だけをモックし、
// minZoom props・「全体」ボタン押下時の fitView 呼び出しを検証する。
let capturedProps: any = null;
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
            screenToFlowPosition: (pos: { x: number; y: number }) => pos,
            fitView: mockFitView,
        }),
    };
});

const soloItem: Item = {
    id: 'item-solo',
    title: '単独アイテム',
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

const mockGetAllItems = vi.fn().mockResolvedValue([soloItem]);

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
        async getDependencies() { return []; }
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
    mockFitView.mockClear();
    mockGetAllItems.mockClear();
    mockGetAllItems.mockResolvedValue([soloItem]);
});

describe('FlowScreen: ズームアウト制限緩和と「全体」ボタン', () => {
    it('minZoomがReact Flowの既定値(0.5)より大幅に緩和されている', async () => {
        renderFlowScreen();

        await waitFor(() => expect(capturedProps).not.toBeNull());
        expect(capturedProps.minZoom).toBeLessThanOrEqual(0.1);
    });

    it('ヘルプボタンの下に「全体」ボタンが表示される', async () => {
        const { getByTitle } = renderFlowScreen();

        await waitFor(() => expect(capturedProps).not.toBeNull());
        expect(getByTitle('全体表示')).toBeInTheDocument();
    });

    it('「全体」ボタンをクリックするとfitViewが呼ばれる', async () => {
        const { getByTitle } = renderFlowScreen();

        await waitFor(() => expect(capturedProps).not.toBeNull());
        mockFitView.mockClear();

        fireEvent.click(getByTitle('全体表示'));

        expect(mockFitView).toHaveBeenCalled();
    });
});
