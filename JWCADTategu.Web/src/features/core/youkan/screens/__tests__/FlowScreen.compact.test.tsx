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

// item-bはitem-aに依存し、意図的に大きな縦の隙間を空けて手動配置した状態を再現する。
// item-cはitem-aとY区間が重なるが、大きな横の隙間を空けて手動配置した状態を再現する（依存なし）
const itemA = makeItem('item-a', 60, 0, 0);
const itemB = makeItem('item-b', 60, 0, 500);
const itemC = makeItem('item-c', 60, 800, 10);

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

const toggleCheckbox = async (name: string) => {
    const user = userEvent.setup();
    await act(async () => {
        await user.click(screen.getByRole('checkbox', { name }));
    });
};

// R-118/R-120: フロー「詰める」ボタン（プレビュー→保存確定方式、縦横独立チェックボックス）
describe('FlowScreen: 詰めるボタン（R-118・R-120）', () => {
    it('「詰める」ボタンが表示される', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());
        expect(screen.getByRole('button', { name: '詰める' })).toBeInTheDocument();
    });

    it('押下するとプレビュー表示のみで、サーバーへは保存されない。既定は縦横とも有効', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-b')).toBeTruthy());
        expect(nodeOf('item-b').position).toEqual({ x: 0, y: 500 });
        expect(nodeOf('item-c').position).toEqual({ x: 800, y: 10 });

        await clickButton('詰める');

        await waitFor(() => {
            // 縦: item-bがitem-aに近づく
            expect(nodeOf('item-b').position.y).toBeLessThan(500);
        });
        // 横: item-cがitem-aに近づく（Y区間が重なるため）
        expect(nodeOf('item-c').position.x).toBeLessThan(800);
        expect(mockUpdateItem).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: '詰めるの縦方向を有効にする' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: '詰めるの横方向を有効にする' })).toBeChecked();
    });

    it('縦チェックのみOFFにすると縦は元のまま・横だけ計算される', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-b')).toBeTruthy());
        await clickButton('詰める');
        await waitFor(() => expect(nodeOf('item-b').position.y).toBeLessThan(500));

        await toggleCheckbox('詰めるの縦方向を有効にする');

        await waitFor(() => {
            expect(nodeOf('item-b').position).toEqual({ x: 0, y: 500 });
        });
        expect(nodeOf('item-c').position.x).toBeLessThan(800);
    });

    it('横チェックのみOFFにすると横は元のまま・縦だけ計算される', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-c')).toBeTruthy());
        await clickButton('詰める');
        await waitFor(() => expect(nodeOf('item-c').position.x).toBeLessThan(800));

        await toggleCheckbox('詰めるの横方向を有効にする');

        await waitFor(() => {
            expect(nodeOf('item-c').position).toEqual({ x: 800, y: 10 });
        });
        expect(nodeOf('item-b').position.y).toBeLessThan(500);
    });

    it('縦横両方OFFにすると変化なし。「保存」を押してもサーバーへは送信されない', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-b')).toBeTruthy());
        await clickButton('詰める');
        await waitFor(() => expect(nodeOf('item-b').position.y).toBeLessThan(500));

        await toggleCheckbox('詰めるの縦方向を有効にする');
        await toggleCheckbox('詰めるの横方向を有効にする');

        await waitFor(() => {
            expect(nodeOf('item-b').position).toEqual({ x: 0, y: 500 });
            expect(nodeOf('item-c').position).toEqual({ x: 800, y: 10 });
        });

        await clickButton('保存');

        expect(mockUpdateItem).not.toHaveBeenCalled();
        await waitFor(() => expect(screen.queryByRole('button', { name: '保存' })).toBeNull());
        // 何も変わっていないため「元に戻す」も出ない
        expect(screen.queryByRole('button', { name: '元に戻す' })).toBeNull();
    });

    it('プレビュー中に縦間隔・横間隔スライダーを変更するとリアルタイムに再計算される', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-b')).toBeTruthy());
        await clickButton('詰める');
        await waitFor(() => expect(nodeOf('item-b').position.y).toBeLessThan(500));
        const defaultGapB = nodeOf('item-b').position.y;
        const defaultGapC = nodeOf('item-c').position.x;

        const gapYSlider = screen.getByLabelText('詰めるの縦間隔') as HTMLInputElement;
        fireEvent.change(gapYSlider, { target: { value: '90' } });
        await waitFor(() => expect(nodeOf('item-b').position.y).not.toBe(defaultGapB));

        const gapXSlider = screen.getByLabelText('詰めるの横間隔') as HTMLInputElement;
        fireEvent.change(gapXSlider, { target: { value: '90' } });
        await waitFor(() => expect(nodeOf('item-c').position.x).not.toBe(defaultGapC));

        expect(mockUpdateItem).not.toHaveBeenCalled();
    });

    it('押下すると横位置は変えず縦の隙間だけが詰まり、サーバーにも保存される（縦のみ有効な場合）', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-b')).toBeTruthy());
        await clickButton('詰める');
        await waitFor(() => expect(nodeOf('item-b').position.y).toBeLessThan(500));
        await toggleCheckbox('詰めるの横方向を有効にする');
        await waitFor(() => expect(nodeOf('item-c').position).toEqual({ x: 800, y: 10 }));

        await clickButton('保存');

        await waitFor(() => expect(mockUpdateItem).toHaveBeenCalledTimes(3));
        const savedB = mockUpdateItem.mock.calls.find((c) => c[0] === 'item-b')![1];
        expect(savedB.meta.flow_x).toBe(0);
        expect(savedB.meta.flow_y).toBe(nodeOf('item-b').position.y);
        const savedC = mockUpdateItem.mock.calls.find((c) => c[0] === 'item-c')![1];
        expect(savedC.meta.flow_x).toBe(800);
    });

    it('「キャンセル」を押すと元の位置に戻り、サーバーへは何も送信されない', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-b')).toBeTruthy());

        await clickButton('詰める');
        await waitFor(() => expect(nodeOf('item-b').position.y).toBeLessThan(500));

        await clickButton('キャンセル');

        await waitFor(() => {
            expect(nodeOf('item-a').position).toEqual({ x: 0, y: 0 });
            expect(nodeOf('item-b').position).toEqual({ x: 0, y: 500 });
            expect(nodeOf('item-c').position).toEqual({ x: 800, y: 10 });
        });
        expect(mockUpdateItem).not.toHaveBeenCalled();
        expect(screen.queryByRole('button', { name: '元に戻す' })).toBeNull();
    });

    it('「元に戻す」で保存後の詰める適用前の位置へ復元される', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-b')).toBeTruthy());

        await clickButton('詰める');
        await clickButton('保存');
        await waitFor(() => expect(nodeOf('item-b').position.y).toBeLessThan(500));

        await clickButton('元に戻す');

        await waitFor(() => {
            expect(nodeOf('item-a').position).toEqual({ x: 0, y: 0 });
            expect(nodeOf('item-b').position).toEqual({ x: 0, y: 500 });
            expect(nodeOf('item-c').position).toEqual({ x: 800, y: 10 });
        });
    });

    it('別の配置系ボタン（自動整理）を押すと詰めるのプレビューはキャンセル扱いで閉じる', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-b')).toBeTruthy());

        await clickButton('詰める');
        await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument());

        await clickButton('自動整理');

        await waitFor(() => expect(mockUpdateItem).not.toHaveBeenCalled());
        expect(screen.getAllByRole('button', { name: '保存' })).toHaveLength(1);
        expect(screen.queryByLabelText('詰めるの縦間隔')).toBeNull();
    });
});
