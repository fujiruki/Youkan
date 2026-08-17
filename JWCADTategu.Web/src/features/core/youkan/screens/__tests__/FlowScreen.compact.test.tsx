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

const makeItem = (id: string, minutes: number, x: number, y: number): Item => ({
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
    estimatedMinutes: minutes,
    meta: { flow_x: x, flow_y: y },
});

// item-bはitem-aに依存し、意図的に大きな縦の隙間を空けて手動配置した状態を再現する
const itemA = makeItem('item-a', 60, 0, 0);
const itemB = makeItem('item-b', 60, 0, 500);
const itemC = makeItem('item-c', 60, 300, 10);

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
    localStorage.clear();
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

// R-118: フロー「詰める」ボタン
describe('FlowScreen: 詰めるボタン（R-118）', () => {
    it('「詰める」ボタンが表示される', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());
        expect(screen.getByRole('button', { name: '詰める' })).toBeInTheDocument();
    });

    it('押下すると横位置は変えず縦の隙間だけが詰まり、サーバーにも保存される', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-b')).toBeTruthy());
        expect(nodeOf('item-b').position).toEqual({ x: 0, y: 500 });

        await clickButton('詰める');

        await waitFor(() => {
            expect(nodeOf('item-b').position.y).toBeLessThan(500);
        });
        // 横位置(x)は変わらない
        expect(nodeOf('item-a').position.x).toBe(0);
        expect(nodeOf('item-b').position.x).toBe(0);
        expect(nodeOf('item-c').position.x).toBe(300);

        await waitFor(() => expect(mockUpdateItem).toHaveBeenCalledTimes(3));
        const savedB = mockUpdateItem.mock.calls.find((c) => c[0] === 'item-b')![1];
        expect(savedB.meta.flow_x).toBe(nodeOf('item-b').position.x);
        expect(savedB.meta.flow_y).toBe(nodeOf('item-b').position.y);
    });

    it('「元に戻す」で詰める適用前の位置へ復元される', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-b')).toBeTruthy());

        await clickButton('詰める');
        await waitFor(() => expect(nodeOf('item-b').position.y).toBeLessThan(500));

        await clickButton('元に戻す');

        await waitFor(() => {
            expect(nodeOf('item-a').position).toEqual({ x: 0, y: 0 });
            expect(nodeOf('item-b').position).toEqual({ x: 0, y: 500 });
            expect(nodeOf('item-c').position).toEqual({ x: 300, y: 10 });
        });
    });
});
