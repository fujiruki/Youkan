import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterProvider } from '../../contexts/FilterContext';
import { ToastProvider } from '../../../../../contexts/ToastContext';
import type { Item } from '../../types';

// R-119: フローチャート画面を開いただけ（ボタン操作なし）で、依存関係はあるが
// flow座標未設定のアイテムが自動的にPUT保存される現象を検証する。
// さらに、プロジェクト切替で再フェッチが起きた際、保存に失敗したアイテムが
// 何度も自動再送信されて失敗トーストが積み重なる不具合を再現する。

vi.mock('@xyflow/react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@xyflow/react')>();
    return {
        ...actual,
        ReactFlow: (props: any) => <div data-testid="mock-reactflow" />,
    };
});

const makeItem = (id: string, overrides: Partial<Item> = {}): Item => ({
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
    meta: {},
    ...overrides,
});

// item-a: 座標設定済み（依存の起点）
const itemA = makeItem('item-a', { meta: { flow_x: 0, flow_y: 0 } });
// item-x: 依存関係はあるが座標未設定 → 自動配置対象。projectId付きでプロジェクト切替の対象にする
const itemX = makeItem('item-x', {
    projectId: 'proj-1',
    projectTitle: 'Proj One',
} as Partial<Item>);

const mockUpdateItem = vi.fn();
const mockGetAllItems = vi.fn();

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
            return [{ id: 'dep-1', sourceItemId: 'item-a', targetItemId: 'item-x', createdAt: 0 }];
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
                <FlowScreen />
            </ToastProvider>
        </FilterProvider>
    );

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // テスト間でwindow.history/locationが残らないようにリセット（FlowScreenはURLからプロジェクトIDを復元するため）
    window.history.pushState({}, '', '/');
    // item-xへのPUTは常に失敗する（モバイル回線の"Load failed"を模す）
    mockUpdateItem.mockImplementation((id: string) => {
        if (id === 'item-x') return Promise.reject(new Error('Load failed'));
        return Promise.resolve({ success: true });
    });
    // 「全プロジェクト」表示時と「proj-1」表示時のどちらでも item-a / item-x を返す
    mockGetAllItems.mockResolvedValue([itemA, itemX]);
});

describe('FlowScreen: 自動配置の自動保存（R-119）', () => {
    it('ボタン操作なしで、依存関係のみ持つ未配置アイテムのPUTが自動的に発生する', async () => {
        renderFlowScreen();
        // プロジェクト選択画面で「全プロジェクト」を選んでFlowCanvasをマウント（自動配置ボタン等は一切押さない）
        const user = userEvent.setup();
        await act(async () => {
            await user.click(screen.getByRole('button', { name: /全プロジェクト/ }));
        });

        await waitFor(() => {
            const call = mockUpdateItem.mock.calls.find((c) => c[0] === 'item-x');
            expect(call).toBeTruthy();
            expect(call![1]).toEqual(
                expect.objectContaining({ meta: expect.objectContaining({ flow_x: expect.any(Number), flow_y: expect.any(Number) }) })
            );
        });
    });

    it('プロジェクト切替で再フェッチが起きても、保存に失敗したアイテムのPUTは1回しか送られない', async () => {
        renderFlowScreen();
        const user = userEvent.setup();
        await act(async () => {
            await user.click(screen.getByRole('button', { name: /全プロジェクト/ }));
        });

        // 1回目の自動配置PUT（失敗する）
        await waitFor(() => {
            expect(mockUpdateItem.mock.calls.filter((c) => c[0] === 'item-x').length).toBeGreaterThanOrEqual(1);
        });
        const firstCallCount = mockUpdateItem.mock.calls.filter((c) => c[0] === 'item-x').length;
        expect(firstCallCount).toBe(1);

        // プロジェクト切替（ヘッダーのドロップダウンからproj-1へ）→ fetchDataが再実行される
        await act(async () => {
            await user.click(screen.getByRole('button', { name: /全プロジェクト/ }));
        });
        await waitFor(() => expect(screen.getByText('Proj One')).toBeInTheDocument());
        await act(async () => {
            await user.click(screen.getByText('Proj One'));
        });

        // 再フェッチ後も待って、item-xへのPUTが増えていないことを確認
        await waitFor(() => expect(mockGetAllItems).toHaveBeenCalledTimes(3)); // 初期selector + 全プロジェクト + proj-1
        await new Promise((r) => setTimeout(r, 50));

        const totalCallsForItemX = mockUpdateItem.mock.calls.filter((c) => c[0] === 'item-x').length;
        expect(totalCallsForItemX).toBe(1);
    });
});
