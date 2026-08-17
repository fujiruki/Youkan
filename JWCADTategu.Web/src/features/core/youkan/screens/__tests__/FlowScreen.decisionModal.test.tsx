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

vi.mock('../../hooks/useExternalEvents', () => ({
    useExternalEvents: () => ({
        eventsByDate: new Map(),
        loading: false,
        error: null,
        refresh: vi.fn(),
        loadMore: vi.fn(),
        loadedRange: { from: '', to: '' },
        isLoadingMore: false,
        loadDirection: null,
    }),
}));

vi.mock('../../hooks/useGoogleCalendars', () => ({
    useGoogleCalendars: () => ({
        calendars: [],
        loading: false,
        error: null,
        refresh: vi.fn(),
        toggle: vi.fn(),
    }),
}));

const makeItem = (id: string): Item => ({
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
    estimatedMinutes: 60,
    meta: { flow_x: 0, flow_y: 0 },
});

const itemA = makeItem('item-a');

const mockGetAllItems = vi.fn().mockResolvedValue([itemA]);
const mockUpdateItem = vi.fn().mockResolvedValue({ success: true });
const mockResolveDecision = vi.fn().mockResolvedValue({ success: true, new_status: 'decision_hold' });

vi.mock('../../../../../api/client', () => ({
    ApiClient: {
        getAllItems: (...args: unknown[]) => mockGetAllItems(...args),
        createItem: vi.fn(),
        updateItem: (...args: unknown[]) => mockUpdateItem(...args),
        deleteItem: vi.fn(),
        resolveDecision: (...args: unknown[]) => mockResolveDecision(...args),
    },
}));

vi.mock('../../repositories/DependencyRepository', () => ({
    DependencyRepository: class {
        async getDependencies() {
            return [];
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
    mockGetAllItems.mockResolvedValue([itemA]);
    mockUpdateItem.mockResolvedValue({ success: true });
    mockResolveDecision.mockResolvedValue({ success: true, new_status: 'decision_hold' });
});

const nodeOf = (id: string) => capturedProps.nodes.find((n: any) => n.id === id);

// R-124: DecisionDetailModalの「保留にする」(hold) を押すと、FlowScreen.tsxの
// onDecisionハンドラが `decision === 'yes' ? 'yes' : 'no'` という三項演算子でholdをnoに
// 握りつぶし、断る(却下)として保存されてしまうバグの回帰テスト。
// 石鎚山プロジェクトで17件が意図せず却下扱いになった直接の原因。
describe('FlowScreen: 詳細モーダルの決定操作（R-124）', () => {
    it('「保留にする」を押すと、resolveDecisionはholdで呼ばれる（noに握りつぶされない）', async () => {
        renderFlowScreen();
        await waitFor(() => expect(nodeOf('item-a')).toBeTruthy());

        // ノードダブルクリックで詳細モーダルを開く
        await act(async () => {
            capturedProps.onNodeDoubleClick({ stopPropagation: () => { } }, { id: 'item-a' });
        });

        const holdButton = await screen.findByRole('button', { name: /保留にする/ });
        const user = userEvent.setup();
        await act(async () => {
            await user.click(holdButton);
        });

        await waitFor(() => expect(mockResolveDecision).toHaveBeenCalled());
        expect(mockResolveDecision.mock.calls[0][1]).toBe('hold');
        expect(mockResolveDecision.mock.calls[0][1]).not.toBe('no');
    });
});
