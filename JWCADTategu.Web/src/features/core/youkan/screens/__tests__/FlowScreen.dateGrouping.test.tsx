import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
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
    localStorage.clear();
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

const clickButton = async (name: string) => {
    const user = userEvent.setup();
    await act(async () => {
        await user.click(screen.getByRole('button', { name }));
    });
};

// R-109/R-113: フローチャート日付表示（帯のみ）＋「日付整列」ボタン
describe('FlowScreen: 日付表示（R-113、帯の表示のみ）', () => {
    it('「日付表示」チェックボックスが表示され、初期状態はOFF', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());

        const checkbox = screen.getByRole('checkbox', { name: '日付表示' });
        expect(checkbox).not.toBeChecked();
        expect(bandNodes()).toHaveLength(0);
        expect(screen.queryByRole('button', { name: '元に戻す' })).toBeNull();
    });

    it('チェックONで日付区間の帯が合計時間・最短時間つきで表示され、ノード位置は変わらずサーバー保存もされない', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());
        const beforeA = nodeOf('item-a').position;
        const beforeB = nodeOf('item-b').position;
        const beforeC = nodeOf('item-c').position;

        await toggleDateGrouping();

        await waitFor(() => expect(bandNodes()).toHaveLength(2));
        const [first, second] = bandNodes();
        // 2026-08-16は日曜日、2026-08-17は月曜日
        expect(first.data.label).toBe('8/16(日)まで');
        expect(first.data.totalMinutes).toBe(180);
        expect(first.data.criticalMinutes).toBe(180);
        expect(second.data.label).toBe('8/17(月)まで');
        expect(second.data.totalMinutes).toBe(60);

        // ノード位置は不変・サーバー保存もされない
        expect(nodeOf('item-a').position).toEqual(beforeA);
        expect(nodeOf('item-b').position).toEqual(beforeB);
        expect(nodeOf('item-c').position).toEqual(beforeC);
        expect(mockUpdateItem).not.toHaveBeenCalled();
        expect(screen.queryByRole('button', { name: '元に戻す' })).toBeNull();
    });

    it('ノードをドラッグすると帯の位置がその場で追従する', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());
        await toggleDateGrouping();
        await waitFor(() => expect(bandNodes()).toHaveLength(2));
        const beforePosition = { ...bandNodes()[0].position };

        // item-a（8/16帯に属するノード）を大きく動かす → 帯の外接矩形が追従するはず
        await act(async () => {
            capturedProps.onNodesChange([
                { id: 'item-a', type: 'position', position: { x: -900, y: -900 }, dragging: true },
            ]);
        });

        await waitFor(() => {
            expect(bandNodes()[0].position).not.toEqual(beforePosition);
        });
    });

    it('「日付整列」ボタンでflow_xは変わらず縦方向だけ移動し、サーバーにも保存される。日付表示のON/OFFは変わらない', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());
        const beforeXA = nodeOf('item-a').position.x;
        const beforeXB = nodeOf('item-b').position.x;
        const beforeXC = nodeOf('item-c').position.x;

        await clickButton('日付整列');

        await waitFor(() => {
            // R-111の帯内配置ルール: flow_xは維持したまま、依存先(b)は依存元(a)より下の行
            expect(nodeOf('item-a').position.x).toBe(beforeXA);
            expect(nodeOf('item-b').position.x).toBe(beforeXB);
            expect(nodeOf('item-c').position.x).toBe(beforeXC);
            expect(nodeOf('item-b').position.y).toBeGreaterThan(nodeOf('item-a').position.y);
            expect(nodeOf('item-c').position.y).toBeGreaterThan(nodeOf('item-b').position.y);
        });

        await waitFor(() => expect(mockUpdateItem).toHaveBeenCalledTimes(3));
        const savedA = mockUpdateItem.mock.calls.find((c) => c[0] === 'item-a')![1];
        expect(savedA.meta.flow_x).toBe(nodeOf('item-a').position.x);
        expect(savedA.meta.flow_y).toBe(nodeOf('item-a').position.y);

        // 日付表示のON/OFFには影響しない
        expect(screen.getByRole('checkbox', { name: '日付表示' })).not.toBeChecked();
    });

    it('「元に戻す」で「日付整列」適用前の位置へ復元される。日付表示のON状態は維持される', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());
        await toggleDateGrouping();
        await waitFor(() => expect(bandNodes()).toHaveLength(2));

        const beforeA = nodeOf('item-a').position;
        const beforeB = nodeOf('item-b').position;
        const beforeC = nodeOf('item-c').position;

        await clickButton('日付整列');
        await waitFor(() => expect(nodeOf('item-a').position).not.toEqual(beforeA));

        await clickButton('元に戻す');

        await waitFor(() => {
            expect(nodeOf('item-a').position).toEqual(beforeA);
            expect(nodeOf('item-b').position).toEqual(beforeB);
            expect(nodeOf('item-c').position).toEqual(beforeC);
        });

        // 日付表示は引き続きONのまま、帯も表示され続ける
        expect(screen.getByRole('checkbox', { name: '日付表示' })).toBeChecked();
        expect(bandNodes().length).toBeGreaterThan(0);
    });

    // R-115: 日付整列の行間隔スライダー
    it('行間隔スライダーの初期値は110', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());
        const slider = screen.getByLabelText('日付整列の行間隔') as HTMLInputElement;
        expect(slider.value).toBe('110');
    });

    it('行間隔スライダーを変更するとlocalStorageに保存され、次回起動時も記憶される', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());
        const slider = screen.getByLabelText('日付整列の行間隔') as HTMLInputElement;

        fireEvent.change(slider, { target: { value: '200' } });

        expect(slider.value).toBe('200');
        expect(localStorage.getItem('youkan_flow_date_align_row_height')).toBe('200');
    });

    it('「日付整列」はスライダーの値を行間隔として使う', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());
        const slider = screen.getByLabelText('日付整列の行間隔') as HTMLInputElement;
        fireEvent.change(slider, { target: { value: '200' } });

        await clickButton('日付整列');

        await waitFor(() => expect(mockUpdateItem).toHaveBeenCalledTimes(3));
        // b(依存元a→依存先b、同帯内)のy座標がスライダー値(200)刻みで離れているはず
        expect(nodeOf('item-b').position.y - nodeOf('item-a').position.y).toBe(200);
    });
});
