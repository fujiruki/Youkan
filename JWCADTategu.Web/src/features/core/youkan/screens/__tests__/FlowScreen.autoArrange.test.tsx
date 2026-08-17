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

const makeItem = (id: string, dueDate: string | null, minutes: number, x: number, y: number): Item => ({
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
    meta: { flow_x: x, flow_y: y },
});

const itemA = makeItem('item-a', null, 60, 0, 0);
const itemB = makeItem('item-b', null, 120, 100, 0);
const itemC = makeItem('item-c', null, 60, 0, 200);

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

// R-112/R-120: フロー「自動整理」ボタン（プレビュー→保存確定方式）
describe('FlowScreen: 自動整理ボタン（R-112・R-120）', () => {
    it('「自動整理」ボタンが表示される', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());
        expect(screen.getByRole('button', { name: '自動整理' })).toBeInTheDocument();
    });

    it('押下するとプレビュー表示のみで、サーバーへは保存されない', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());
        const beforeB = nodeOf('item-b').position;

        await clickButton('自動整理');

        await waitFor(() => {
            expect(nodeOf('item-b').position).not.toEqual(beforeB);
        });
        expect(mockUpdateItem).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument();
    });

    it('プレビュー中に縦間隔スライダーを変更するとリアルタイムに再計算される', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());
        await clickButton('自動整理');
        await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument());
        const afterDefaultGap = nodeOf('item-b').position.y;

        const slider = screen.getByLabelText('自動整理の縦間隔') as HTMLInputElement;
        fireEvent.change(slider, { target: { value: '90' } });

        await waitFor(() => expect(nodeOf('item-b').position.y).not.toBe(afterDefaultGap));
        // まだサーバー保存はされない
        expect(mockUpdateItem).not.toHaveBeenCalled();
    });

    it('「保存」を押すとプレビュー位置が確定保存され、パネルが閉じる', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());
        await clickButton('自動整理');
        await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument());
        const previewB = nodeOf('item-b').position;

        await clickButton('保存');

        await waitFor(() => expect(mockUpdateItem).toHaveBeenCalledTimes(3));
        const savedB = mockUpdateItem.mock.calls.find((c) => c[0] === 'item-b')![1];
        expect(savedB.meta.flow_x).toBe(previewB.x);
        expect(savedB.meta.flow_y).toBe(previewB.y);
        expect(screen.queryByRole('button', { name: '保存' })).toBeNull();
        // 保存後は既存の「元に戻す」Undoが使えるようになる
        expect(screen.getByRole('button', { name: '元に戻す' })).toBeInTheDocument();
    });

    // R-121: 保存確定時の座標PUTが並行送信されると、本番環境（PHPが複数プロセスで並行実行される）で
    // SQLiteの単一ライターロックに数十件のPUTが同時に殺到し、busy_timeout超過で「database is
    // locked」失敗が多発した。1件ずつ逐次送信することでこの同時書き込みそのものを防ぐ
    it('「保存」時の座標PUTは並行送信せず1件ずつ逐次送信する', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());
        await clickButton('自動整理');
        await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument());

        let resolveFirst: (() => void) | undefined;
        mockUpdateItem.mockImplementation(() => {
            if (mockUpdateItem.mock.calls.length === 1) {
                return new Promise((resolve) => {
                    resolveFirst = () => resolve({ success: true });
                });
            }
            return Promise.resolve({ success: true });
        });

        await clickButton('保存');

        // 1件目のPUTがまだ応答を返していない間は、2件目以降がまだ送信されていないはず
        await waitFor(() => expect(mockUpdateItem).toHaveBeenCalledTimes(1));
        await new Promise((r) => setTimeout(r, 20));
        expect(mockUpdateItem).toHaveBeenCalledTimes(1);

        resolveFirst?.();

        await waitFor(() => expect(mockUpdateItem).toHaveBeenCalledTimes(3));
    });

    it('「キャンセル」を押すと元の位置に戻り、サーバーへは何も送信されない', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());
        const beforeB = nodeOf('item-b').position;

        await clickButton('自動整理');
        await waitFor(() => expect(nodeOf('item-b').position).not.toEqual(beforeB));

        await clickButton('キャンセル');

        await waitFor(() => expect(nodeOf('item-b').position).toEqual(beforeB));
        expect(mockUpdateItem).not.toHaveBeenCalled();
        expect(screen.queryByRole('button', { name: '保存' })).toBeNull();
        expect(screen.queryByRole('button', { name: '元に戻す' })).toBeNull();
    });

    it('「元に戻す」で保存後の自動整理を1段階復元できる', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-b')).toBeTruthy());
        expect(nodeOf('item-b').position).toEqual({ x: 100, y: 0 });

        await clickButton('自動整理');
        await clickButton('保存');
        await waitFor(() => expect(nodeOf('item-b').position).not.toEqual({ x: 100, y: 0 }));

        await clickButton('元に戻す');

        await waitFor(() => {
            expect(nodeOf('item-a').position).toEqual({ x: 0, y: 0 });
            expect(nodeOf('item-b').position).toEqual({ x: 100, y: 0 });
            expect(nodeOf('item-c').position).toEqual({ x: 0, y: 200 });
        });
    });

    it('日付表示チェックON中でも自動整理ボタンは有効（R-113で無効化を撤廃）', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());

        const user = userEvent.setup();
        await act(async () => {
            await user.click(screen.getByRole('checkbox', { name: '日付表示' }));
        });

        expect(screen.getByRole('button', { name: '自動整理' })).not.toBeDisabled();
    });

    // R-114: 自動整理の縦間隔スライダー
    it('縦間隔スライダーの初期値は35', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());
        const slider = screen.getByLabelText('自動整理の縦間隔') as HTMLInputElement;
        expect(slider.value).toBe('35');
    });

    it('スライダーを変更するとlocalStorageに保存され、次回起動時も記憶される', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());
        const slider = screen.getByLabelText('自動整理の縦間隔') as HTMLInputElement;

        fireEvent.change(slider, { target: { value: '80' } });

        expect(slider.value).toBe('80');
        expect(localStorage.getItem('youkan_flow_arrange_gap_y')).toBe('80');
    });

    it('自動整理はプレビュー開始時点のスライダーの値をgapYとして使う', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());
        const slider = screen.getByLabelText('自動整理の縦間隔') as HTMLInputElement;
        fireEvent.change(slider, { target: { value: '90' } });

        await clickButton('自動整理');
        await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument());
        await clickButton('保存');

        await waitFor(() => expect(mockUpdateItem).toHaveBeenCalledTimes(3));
        // b(依存元a→依存先b)のy座標がa+層の高さ+gapYになっているはず（厳密な形状はflowAutoArrange.test.tsで検証済み）
        expect(nodeOf('item-b').position.y).toBeGreaterThan(nodeOf('item-a').position.y);
    });

    it('別の配置系ボタン（日付整列）を押すと自動整理のプレビューはキャンセル扱いで閉じる', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());

        await clickButton('自動整理');
        await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument());

        await clickButton('日付整列');

        await waitFor(() => expect(mockUpdateItem).not.toHaveBeenCalled());
        // 保存/キャンセルパネルは1つだけ（日付整列側）残る
        expect(screen.getAllByRole('button', { name: '保存' })).toHaveLength(1);
    });
});
