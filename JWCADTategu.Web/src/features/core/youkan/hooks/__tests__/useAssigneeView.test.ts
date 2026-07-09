import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAssigneeView } from '../useAssigneeView';
import { ApiClient } from '../../../../../api/client';
import { useAuth } from '../../../auth/providers/AuthProvider';
import { Item, Member } from '../../types';

const showToastMock = vi.fn();
vi.mock('../../../../../contexts/ToastContext', () => ({
    useToast: () => ({ showToast: showToastMock, toasts: [], dismissToast: vi.fn() }),
}));

const useAssigneesMock = vi.fn();
vi.mock('../useAssignees', () => ({
    useAssignees: () => useAssigneesMock(),
}));

function makeItem(overrides: Partial<Item>): Item {
    return {
        id: overrides.id || 'item-1',
        title: overrides.title || 'テスト項目',
        status: overrides.status || 'focus',
        focusOrder: 0,
        isEngaged: false,
        statusUpdatedAt: 0,
        interrupt: false,
        weight: 1,
        createdAt: 0,
        updatedAt: 0,
        ...overrides,
    };
}

const SELF_ID = 'u_self123';

function mockAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
    vi.mocked(useAuth).mockReturnValue({
        user: { id: SELF_ID, name: '自分', email: 'self@example.com' } as any,
        tenant: { id: 't_1', name: '藤田建具店', title: '藤田建具店', role: 'user' } as any,
        joinedTenants: [],
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
        switchTenant: vi.fn(),
        ...overrides,
    });
}

describe('useAssigneeView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useAssigneesMock.mockReturnValue({ assignees: [], loading: false, error: null, refresh: vi.fn() });
    });

    it('マウント時に自分の担当分（scope=team, assigned_to=自分）を取得する', async () => {
        mockAuth();
        const spy = vi.spyOn(ApiClient, 'getAllItems').mockResolvedValue([makeItem({ id: 'a' })]);

        const { result } = renderHook(() => useAssigneeView());

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(spy).toHaveBeenCalledWith({ scope: 'team', assigned_to: SELF_ID });
        expect(result.current.items).toHaveLength(1);
        expect(result.current.selectedAssignedTo).toBe(SELF_ID);
    });

    it('個人モード（tenant=null）ではAPIを呼ばない', async () => {
        mockAuth({ tenant: null });
        const spy = vi.spyOn(ApiClient, 'getAllItems').mockResolvedValue([]);

        renderHook(() => useAssigneeView());

        await new Promise(r => setTimeout(r, 0));
        expect(spy).not.toHaveBeenCalled();
    });

    it('管理者ロール（owner/admin）の場合のみ GET /tenant/members を取得する', async () => {
        mockAuth({ tenant: { id: 't_1', name: 'X', title: 'X', role: 'owner' } as any });
        vi.spyOn(ApiClient, 'getAllItems').mockResolvedValue([]);
        const requestSpy = vi.spyOn(ApiClient, 'request').mockResolvedValue([] as any);

        const { result } = renderHook(() => useAssigneeView());
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(requestSpy).toHaveBeenCalledWith('GET', '/tenant/members');
    });

    it('非管理者ロールでは GET /tenant/members を取得しない', async () => {
        mockAuth({ tenant: { id: 't_1', name: 'X', title: 'X', role: 'user' } as any });
        vi.spyOn(ApiClient, 'getAllItems').mockResolvedValue([]);
        const requestSpy = vi.spyOn(ApiClient, 'request').mockResolvedValue([] as any);

        const { result } = renderHook(() => useAssigneeView());
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(requestSpy).not.toHaveBeenCalledWith('GET', '/tenant/members');
        expect(result.current.isAdmin).toBe(false);
    });

    it('管理者は候補チップ一覧を自分先頭固定でテナントメンバー・assignees由来を統合する', async () => {
        mockAuth({ tenant: { id: 't_1', name: 'X', title: 'X', role: 'admin' } as any });
        vi.spyOn(ApiClient, 'getAllItems').mockResolvedValue([]);
        const members: Member[] = [
            { id: 'm1', userId: SELF_ID, display_name: '自分', role: 'admin', isCore: true, dailyCapacityMinutes: 480 },
            { id: 'm2', userId: 'u_other', display_name: '晴樹', role: 'user', isCore: true, dailyCapacityMinutes: 420 },
        ];
        vi.spyOn(ApiClient, 'request').mockResolvedValue(members as any);
        useAssigneesMock.mockReturnValue({
            assignees: [{ id: '3', name: '外注業者A', type: 'external', color: '#4f46e5', createdAt: 0 }],
            loading: false, error: null, refresh: vi.fn(),
        });

        const { result } = renderHook(() => useAssigneeView());
        await waitFor(() => expect(result.current.loading).toBe(false));
        await waitFor(() => expect(result.current.candidates.length).toBeGreaterThan(1));

        expect(result.current.candidates[0].id).toBe(SELF_ID);
        expect(result.current.candidates.map(c => c.id)).toEqual(
            expect.arrayContaining([SELF_ID, 'u_other', '3'])
        );
        const assigneeCandidate = result.current.candidates.find(c => c.id === '3');
        expect(assigneeCandidate?.kind).toBe('assignee');
    });

    it('担当者を切り替えると assigned_to を差し替えて再取得する', async () => {
        mockAuth({ tenant: { id: 't_1', name: 'X', title: 'X', role: 'owner' } as any });
        const spy = vi.spyOn(ApiClient, 'getAllItems')
            .mockResolvedValueOnce([makeItem({ id: 'self-item' })])
            .mockResolvedValueOnce([makeItem({ id: 'other-item' })]);
        vi.spyOn(ApiClient, 'request').mockResolvedValue([] as any);

        const { result } = renderHook(() => useAssigneeView());
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.selectAssignee('u_other');
        });

        expect(spy).toHaveBeenLastCalledWith({ scope: 'team', assigned_to: 'u_other' });
        expect(result.current.selectedAssignedTo).toBe('u_other');
        expect(result.current.items.map(i => i.id)).toEqual(['other-item']);
    });

    it('403/404エラー時はトースト表示のうえ自分の担当分にフォールバックする', async () => {
        mockAuth({ tenant: { id: 't_1', name: 'X', title: 'X', role: 'owner' } as any });
        vi.spyOn(ApiClient, 'request').mockResolvedValue([] as any);
        const spy = vi.spyOn(ApiClient, 'getAllItems')
            .mockResolvedValueOnce([makeItem({ id: 'self-item' })]) // 初回マウント（自分）
            .mockRejectedValueOnce(new Error('API Error: 403')) // 他者切替失敗
            .mockResolvedValueOnce([makeItem({ id: 'self-item-fallback' })]); // フォールバック再取得

        const { result } = renderHook(() => useAssigneeView());
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.selectAssignee('u_other');
        });

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(showToastMock).toHaveBeenCalled();
        expect(result.current.selectedAssignedTo).toBe(SELF_ID);
        expect(result.current.items.map(i => i.id)).toEqual(['self-item-fallback']);
    });

    it('取得したアイテムをバケット分類・集計して返す', async () => {
        mockAuth();
        const todayStr = new Date().toISOString().slice(0, 10);
        vi.spyOn(ApiClient, 'getAllItems').mockResolvedValue([
            makeItem({ id: 'today-1', due_date: todayStr, estimatedMinutes: 60 }),
            makeItem({ id: 'waiting-1', status: 'waiting' }),
        ]);

        const { result } = renderHook(() => useAssigneeView());
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.buckets.today.map(i => i.id)).toEqual(['today-1']);
        expect(result.current.todayMinutes).toBe(60);
        expect(result.current.statusSummary.waiting).toBe(1);
    });
});
