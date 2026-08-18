import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { FilterProvider } from '../../contexts/FilterContext';
import { ToastProvider } from '../../../../../contexts/ToastContext';
import type { Item } from '../../types';

let capturedFlowProps: any = null;
let capturedModalProps: any = null;

vi.mock('@xyflow/react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@xyflow/react')>();
    return {
        ...actual,
        ReactFlow: (props: any) => {
            capturedFlowProps = props;
            return <div data-testid="mock-reactflow" />;
        },
    };
});

vi.mock('../../components/Modal/DecisionDetailModal', () => ({
    DecisionDetailModal: (props: any) => {
        capturedModalProps = props;
        return <div data-testid="mock-detail-modal" />;
    },
}));

vi.mock('../../../auth/providers/AuthProvider', () => ({
    useAuth: () => ({
        isAuthenticated: true,
        user: { id: 'test-user', name: 'Test User' },
        joinedTenants: [{ id: 'tenant-1', name: '会社A' }],
    }),
}));

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
    useGoogleCalendars: () => ({ calendars: [], loading: false, error: null, refresh: vi.fn(), toggle: vi.fn() }),
}));

const makeItem = (id: string, extra: Partial<Item> = {}): Item => ({
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
    ...extra,
});

const projectItem = makeItem('proj-1', { isProject: true, tenantId: 'tenant-1' });
const taskItem = makeItem('item-a', { projectId: 'proj-1', tenantId: 'tenant-1' });

const { mockGetAllItems } = vi.hoisted(() => ({ mockGetAllItems: vi.fn() }));

vi.mock('../../../../../api/client', () => ({
    ApiClient: {
        getAllItems: (...args: unknown[]) => mockGetAllItems(...args),
        createItem: vi.fn(),
        updateItem: vi.fn().mockResolvedValue({ success: true }),
        deleteItem: vi.fn(),
        resolveDecision: vi.fn().mockResolvedValue({ success: true }),
    },
}));

vi.mock('../../repositories/DependencyRepository', () => ({
    DependencyRepository: class {
        async getDependencies() { return []; }
        async createDependency() { return null; }
        async deleteDependency() { return; }
    },
}));

import { FlowScreen } from '../FlowScreen';

beforeEach(() => {
    capturedFlowProps = null;
    capturedModalProps = null;
    localStorage.clear();
    mockGetAllItems.mockResolvedValue([projectItem, taskItem]);
});

// R-142: FlowScreen が DecisionDetailModal に joinedTenants / allProjects を渡しておらず、
// 所属欄が「PRIVATE」「Inbox（未分類）」と誤表示され、誤操作で tenantId/projectId が null 化するバグの回帰テスト
describe('FlowScreen: 詳細モーダルへの joinedTenants / allProjects 受け渡し（R-142）', () => {
    it('joinedTenants と allProjects が空でない配列で渡される', async () => {
        render(
            <FilterProvider>
                <ToastProvider>
                    <FlowScreen initialProjectId="__all__" />
                </ToastProvider>
            </FilterProvider>
        );
        await waitFor(() => expect(capturedFlowProps?.nodes?.find((n: any) => n.id === 'item-a')).toBeTruthy());

        await act(async () => {
            capturedFlowProps.onNodeDoubleClick({ stopPropagation: () => { } }, { id: 'item-a' });
        });

        await waitFor(() => expect(capturedModalProps).not.toBeNull());
        expect(capturedModalProps.item.id).toBe('item-a');
        expect(capturedModalProps.joinedTenants).toEqual([{ id: 'tenant-1', name: '会社A' }]);
        expect(capturedModalProps.allProjects.map((p: Item) => p.id)).toEqual(['proj-1']);
    });
});
