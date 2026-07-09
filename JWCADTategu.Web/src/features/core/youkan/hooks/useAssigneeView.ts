import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiClient } from '../../../../api/client';
import { useToast } from '../../../../contexts/ToastContext';
import { useAuth } from '../../auth/providers/AuthProvider';
import { Item, Member } from '../types';
import {
    AssigneeViewBuckets,
    AssigneeViewStatusSummary,
    classifyDueDateBuckets,
    countStatusSummary,
    resolveDailyCapacityMinutes,
    sumEstimatedMinutes,
} from '../logic/assigneeViewBuckets';
import { useAssignees } from './useAssignees';

export interface AssigneeCandidate {
    id: string;
    name: string;
    kind: 'user' | 'assignee';
    color?: string;
    dailyCapacityMinutes?: number;
    capacityProfile?: Member['capacityProfile'];
}

export interface UseAssigneeViewResult {
    items: Item[];
    loading: boolean;
    error: string | null;
    isAdmin: boolean;
    candidates: AssigneeCandidate[];
    selectedAssignedTo: string;
    selectedCandidate: AssigneeCandidate | null;
    selectAssignee: (assignedTo: string) => Promise<void>;
    refresh: () => Promise<void>;
    buckets: AssigneeViewBuckets;
    todayMinutes: number;
    capacityMinutes: number | null;
    statusSummary: AssigneeViewStatusSummary;
}

const ACCESS_ERROR_PATTERN = /403|404/;

export function useAssigneeView(): UseAssigneeViewResult {
    const { user, tenant } = useAuth();
    const { showToast } = useToast();
    const { assignees } = useAssignees();

    const selfId = user?.id || '';
    const isAdmin = tenant?.role === 'owner' || tenant?.role === 'admin';

    const [selectedAssignedTo, setSelectedAssignedTo] = useState(selfId);
    const [items, setItems] = useState<Item[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 管理者のみ担当者候補（テナントメンバー）を取得する（03_画面設計.md §13.3）
    useEffect(() => {
        if (!isAdmin || !tenant) return;
        (async () => {
            try {
                const data = await ApiClient.request<Member[]>('GET', '/tenant/members');
                setMembers(data);
            } catch (e) {
                console.error('[useAssigneeView] failed to load tenant members', e);
            }
        })();
    }, [isAdmin, tenant?.id]);

    const loadItemsFor = useCallback(async (assignedTo: string): Promise<Item[]> => {
        return ApiClient.getAllItems({ scope: 'team', assigned_to: assignedTo });
    }, []);

    const selectAssignee = useCallback(async (assignedTo: string) => {
        if (!assignedTo || !tenant) return;
        setSelectedAssignedTo(assignedTo);
        setLoading(true);
        setError(null);
        try {
            const data = await loadItemsFor(assignedTo);
            setItems(data);
        } catch (e: any) {
            const message = String(e?.message || '');
            if (ACCESS_ERROR_PATTERN.test(message)) {
                showToast({
                    type: 'error',
                    title: '担当者別ビュー',
                    message: '指定した担当者のアイテムを取得できませんでした。自分の担当分を表示します。',
                });
                setSelectedAssignedTo(selfId);
                try {
                    const fallback = await loadItemsFor(selfId);
                    setItems(fallback);
                } catch (e2: any) {
                    setError(String(e2?.message || '担当者データの取得に失敗しました'));
                }
            } else {
                setError(message || '担当者データの取得に失敗しました');
            }
        } finally {
            setLoading(false);
        }
    }, [tenant, selfId, loadItemsFor, showToast]);

    // 初期表示: 常に自分の担当分（03_画面設計.md §13.2）
    useEffect(() => {
        if (selfId && tenant) {
            selectAssignee(selfId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selfId, tenant?.id]);

    const refresh = useCallback(async () => {
        await selectAssignee(selectedAssignedTo || selfId);
    }, [selectAssignee, selectedAssignedTo, selfId]);

    const candidates: AssigneeCandidate[] = useMemo(() => {
        const selfMember = members.find(m => m.userId === selfId);
        const selfCandidate: AssigneeCandidate = {
            id: selfId,
            name: user?.name || '自分',
            kind: 'user',
            dailyCapacityMinutes: selfMember?.dailyCapacityMinutes,
            capacityProfile: selfMember?.capacityProfile,
        };

        const memberCandidates: AssigneeCandidate[] = members
            .filter(m => m.userId !== selfId)
            .map(m => ({
                id: m.userId,
                name: m.display_name,
                kind: 'user',
                dailyCapacityMinutes: m.dailyCapacityMinutes,
                capacityProfile: m.capacityProfile,
            }));

        const assigneeCandidates: AssigneeCandidate[] = assignees.map(a => ({
            id: a.id,
            name: a.name,
            kind: 'assignee',
            color: a.color,
        }));

        return [selfCandidate, ...memberCandidates, ...assigneeCandidates];
    }, [members, assignees, selfId, user?.name]);

    const selectedCandidate = useMemo(
        () => candidates.find(c => c.id === selectedAssignedTo) || null,
        [candidates, selectedAssignedTo]
    );

    const buckets = useMemo(() => classifyDueDateBuckets(items), [items]);
    const todayMinutes = useMemo(() => sumEstimatedMinutes(buckets.today), [buckets.today]);
    const statusSummary = useMemo(() => countStatusSummary(items), [items]);

    const capacityMinutes = useMemo(() => {
        if (!selectedCandidate || selectedCandidate.kind !== 'user') return null;
        if (selectedCandidate.dailyCapacityMinutes === undefined && !selectedCandidate.capacityProfile) return null;
        return resolveDailyCapacityMinutes(selectedCandidate);
    }, [selectedCandidate]);

    return {
        items,
        loading,
        error,
        isAdmin,
        candidates,
        selectedAssignedTo,
        selectedCandidate,
        selectAssignee,
        refresh,
        buckets,
        todayMinutes,
        capacityMinutes,
        statusSummary,
    };
}
