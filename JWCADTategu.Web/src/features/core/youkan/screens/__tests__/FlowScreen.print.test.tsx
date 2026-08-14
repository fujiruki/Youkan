import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { FilterProvider } from '../../contexts/FilterContext';
import { ToastProvider } from '../../../../../contexts/ToastContext';
import type { Item } from '../../types';

// @xyflow/react の <ReactFlow> 本体と useReactFlow() の fitView だけをモックし、
// 「印刷」ボタン押下時の fitView（即時）→ window.print の呼び出し順序を検証する。
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

const unplacedItem: Item = {
    ...soloItem,
    id: 'item-unplaced',
    title: '未配置アイテム',
    meta: {},
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

describe('FlowScreen 印刷ボタン（R-101）', () => {
    it('印刷ボタンが表示される', async () => {
        const { getByTitle } = renderFlowScreen();

        await waitFor(() => expect(capturedProps).not.toBeNull());
        expect(getByTitle('印刷')).toBeInTheDocument();
    });

    it('印刷ボタンをクリックすると、fitViewが即時実行（duration:0）された後にwindow.printが呼ばれる', async () => {
        const printSpy = vi.spyOn(window, 'print').mockImplementation(() => { });
        const { getByTitle } = renderFlowScreen();

        await waitFor(() => expect(capturedProps).not.toBeNull());
        mockFitView.mockClear();

        fireEvent.click(getByTitle('印刷'));

        expect(mockFitView).toHaveBeenCalledWith({ duration: 0, padding: 0.1 });
        expect(printSpy).toHaveBeenCalledTimes(1);

        const fitViewOrder = mockFitView.mock.invocationCallOrder[0];
        const printOrder = printSpy.mock.invocationCallOrder[0];
        expect(fitViewOrder).toBeLessThan(printOrder);

        printSpy.mockRestore();
    });

    it('未配置パネルは印刷対象外（.no-print）である', async () => {
        mockGetAllItems.mockResolvedValue([soloItem, unplacedItem]);
        const { findByText } = renderFlowScreen();

        const heading = await findByText(/未配置 \(1\)/);
        expect(heading.closest('.no-print')).not.toBeNull();
    });

    it('R-102: beforeprintイベントで用紙サイズ確定後の再フィットが行われる', async () => {
        const printSpy = vi.spyOn(window, 'print').mockImplementation(() => { });
        const { getByTitle } = renderFlowScreen();

        await waitFor(() => expect(capturedProps).not.toBeNull());
        mockFitView.mockClear();

        fireEvent.click(getByTitle('印刷'));
        expect(mockFitView).toHaveBeenCalledTimes(1);

        // ブラウザが印刷用レイアウトを確定させた後に発火する beforeprint で、
        // その時点のサイズを基準に再度 fitView が実行されること
        window.dispatchEvent(new Event('beforeprint'));
        expect(mockFitView).toHaveBeenCalledTimes(2);
        expect(mockFitView).toHaveBeenLastCalledWith({ duration: 0, padding: 0.1 });

        printSpy.mockRestore();
    });
});
