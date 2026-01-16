import { useState, useEffect, useCallback } from 'react';
import { JBWOSRepository } from '../repositories/JBWOSRepository';
import { Item, SideMemo, CapacityConfig } from '../types';
import { useUndo } from '../contexts/UndoContext';

export const useJBWOSViewModel = () => {
    // Phase 2: Dumb UI ViewModel (Server is the Brain)

    // --- State (Aligned with v3.1 Zones) ---
    // GDB Shelf
    // GDB Shelf
    const [gdbActive, setGdbActive] = useState<Item[]>([]); // Inbox + Decision (Judgment)
    const [gdbPreparation, setGdbPreparation] = useState<Item[]>([]); // Preparation (Blurry)
    const [gdbIntent, setGdbIntent] = useState<Item[]>([]); // [NEW] Intent
    const [gdbLog, setGdbLog] = useState<Item[]>([]);

    // Today Screen
    const [todayCandidates, setTodayCandidates] = useState<Item[]>([]);
    const [todayCommits, setTodayCommits] = useState<Item[]>([]); // Max 2
    const [executionItem, setExecutionItem] = useState<Item | null>(null); // Only 1 active

    // Side Memos
    const [memos, setMemos] = useState<SideMemo[]>([]);

    // Loading & Error
    const [error, setError] = useState<string | null>(null);

    // --- Data Fetching ---
    const refreshGdb = useCallback(async () => {
        try {
            const shelf = await JBWOSRepository.getGdbShelf();
            setGdbActive(shelf.active || []);
            setGdbPreparation(shelf.preparation || []); // Migrated from hold
            setGdbIntent(shelf.intent || []); // [NEW]
            setGdbLog(shelf.log || []);
        } catch (e) {
            console.error('Failed to fetch GDB:', e);
        }
    }, []);

    const refreshToday = useCallback(async () => {
        try {
            const today = await JBWOSRepository.getTodayView();
            setTodayCommits(today.commits || []);
            setExecutionItem(today.execution || null);
            setTodayCandidates(today.candidates || []);
        } catch (e) {
            console.error('Failed to fetch Today:', e);
        }
    }, []);

    const refreshMemos = useCallback(async () => {
        try {
            const data = await JBWOSRepository.getMemos();
            setMemos(data);
        } catch (e) {
            console.error('Failed to fetch Memos:', e);
        }
    }, []);

    const refreshAll = useCallback(() => {
        refreshGdb();
        refreshToday();
        refreshMemos();
    }, [refreshGdb, refreshToday, refreshMemos]);

    // Initial Load & Global Refresh Listener
    useEffect(() => {
        refreshAll();

        const handleGlobalRefresh = () => {
            console.log('[ViewModel] Global refresh triggered');
            refreshAll();
        };

        window.addEventListener('jbwos-data-changed', handleGlobalRefresh);
        return () => window.removeEventListener('jbwos-data-changed', handleGlobalRefresh);
    }, [refreshAll]);

    // --- Optimistic Actions ---

    // --- Undo Context ---
    const { addUndoAction } = useUndo();

    // 1. Decision (Yes/No/Hold)
    const resolveDecision = async (id: string, decision: 'yes' | 'hold' | 'no', note?: string) => {
        // Optimistic Update: Remove from Active immediate
        setGdbActive(prev => prev.filter(i => i.id !== id));

        // [Undo] Register Action
        addUndoAction({
            type: 'decision',
            id,
            previousStatus: 'inbox',
            description: `「${decision === 'yes' ? 'Yes' : decision === 'hold' ? 'Hold' : 'No'}」と判断しました`
        });

        try {
            await JBWOSRepository.resolveDecision(id, decision, note);
            // On success, background refresh to sync (e.g. move to Today Candidate)
            refreshAll();
        } catch (e) {
            console.error('Decision failed:', e);
            setError('判断の保存に失敗しました。リロードしてください。');
            refreshAll(); // Rollback by fetch
        }
    };

    // 2. Commit to Today
    const commitToToday = async (id: string) => {
        // Guard: Client-side check for UI feedback only (Server has final say)
        if (todayCommits.length >= 2) {
            setError('今日はもう手一杯です（最大2件）');
            return;
        }

        // Optimistic: Move from Candidate to Commit
        const target = todayCandidates.find(i => i.id === id);
        if (target) {
            setTodayCandidates(prev => prev.filter(i => i.id !== id));
            setTodayCommits(prev => [...prev, { ...target, status: 'today_commit' } as any]);
        }

        // [Undo] Register Action - (Status: confirmed -> today_commit)
        addUndoAction({
            type: 'decision',
            id,
            previousStatus: 'confirmed', // Revert to 'confirmed' (Today Candidate)
            description: '今日やること(Commit)に追加しました'
        });

        try {
            const res = await JBWOSRepository.commitToToday(id);
            // If server rejects (e.g. race condition), it throws or returns error
            if ((res as any).error) {
                throw new Error((res as any).error);
            }
            refreshToday();
        } catch (e) {
            console.error('Commit failed:', e);
            setError('コミットに失敗しました。上限を超えている可能性があります。');
            refreshToday(); // Rollback
        }
    };

    const completeItem = async (id: string) => {
        // Optimistic: Calculate next state based on current closure (safe in this hook)
        const nextList = todayCommits.filter(i => i.id !== id);
        setTodayCommits(nextList);

        // Auto-promote
        if (executionItem?.id === id) {
            setExecutionItem(nextList.length > 0 ? nextList[0] : null);
        }

        // [Undo] Register Action 
        addUndoAction({
            type: 'complete',
            id,
            previousStatus: 'today_commit',
            description: 'タスクを完了しました'
        });

        try {
            await JBWOSRepository.completeItem(id);
            // refreshToday(); // Removed to prevent flicker/stale overwrite
        } catch (e) {
            console.error('Complete failed:', e);
            setError('完了への移動に失敗しました。');
            refreshToday(); // Rollback on error only
        }
    };

    // 3. Side Actions (Throw In / Memo)
    const addSideMemo = async (content: string) => {
        // Optimistic add? - Skip for now, fast enough usually.
        await JBWOSRepository.createMemo(content);
        refreshMemos();
    };

    const deleteSideMemo = async (id: string) => {
        setMemos(prev => prev.filter(m => m.id !== id));
        // Todo: Undo implementation for Memo
        await JBWOSRepository.deleteMemo(id);
    };

    const memoToInbox = async (id: string) => {
        setMemos(prev => prev.filter(m => m.id !== id));

        // [Undo] Not implemented yet for Memo transfer

        await JBWOSRepository.moveMemoToInbox(id);
        refreshGdb(); // Will appear in Inbox
    };

    const deleteItem = async (id: string) => {
        // Find item to save for undo (if we had full item data, we could recreate)
        // For MVP, we don't have full item data passed here, only ID. 
        // We can't implement CREATE-UNDO without data.
        // WORKAROUND: For 'decision=no', we usually just log/delete.
        // If we want to support undoing 'delete', we need to fetch it first or have it passed.
        // For now, let's omit DELETE UNDO unless we changes 'delete' to 'archive' status.
        // User asked for "Ctrl+Z" generally.
        // The most critical ones are Decision and Completion. I will prioritize those.

        // Optimistic UI
        setGdbActive(prev => prev.filter(i => i.id !== id));
        setGdbPreparation(prev => prev.filter(i => i.id !== id));
        setTodayCandidates(prev => prev.filter(i => i.id !== id)); // [FIX] Remove from Today Candidates
        setTodayCommits(prev => prev.filter(i => i.id !== id));    // [FIX] Remove from Today Commits

        try {
            await JBWOSRepository.deleteItem(id);
        } catch (e) {
            console.error('Delete item failed', e);
            refreshGdb();
        }
    };

    const returnToInbox = async (id: string, currentStatus: string = 'today_commit') => {
        // Optimistic
        const nextList = todayCommits.filter(i => i.id !== id);
        setTodayCommits(nextList);
        setTodayCandidates(prev => prev.filter(i => i.id !== id));

        // Auto-promote
        if (executionItem?.id === id) {
            setExecutionItem(nextList.length > 0 ? nextList[0] : null);
        }

        // [Undo] Register Action
        addUndoAction({
            type: 'decision', // Treat as a status change
            id,
            previousStatus: currentStatus === 'today_commit' ? 'today_commit' : 'confirmed',
            description: 'Inboxに戻しました'
        });

        try {
            await JBWOSRepository.updateItem(id, { status: 'inbox', is_boosted: false }); // Reset boost too
            // refreshGdb(); // It goes to Inbox
            // refreshToday(); // Removed to prevent flicker
        } catch (e) {
            console.error('Return to Inbox failed', e);
            refreshToday();
        }
    };

    // [NEW] Flexibility: Prioritize (Wait -> Active)
    const prioritizeTask = async (id: string) => {
        // Optimistic: Move to top of todayCommits
        setTodayCommits(prev => {
            const target = prev.find(i => i.id === id);
            if (!target) return prev;
            const others = prev.filter(i => i.id !== id);
            return [target, ...others];
        });
        // Optimistic: Update executionItem immediately
        const target = todayCommits.find(i => i.id === id);
        if (target) setExecutionItem(target);

        try {
            // Server-side: Start Execution (implicitly makes it active/top)
            await JBWOSRepository.startExecution(id);
            refreshToday();
        } catch (e) {
            console.error('Prioritize failed', e);
            refreshToday();
        }
    };

    // [NEW] Flexibility: Uncommit (Today Commit -> Candidate)
    const uncommitFromToday = async (id: string) => {
        // Guard: Don't uncommit active if it's running? Optional.
        // Optimistic: Remove from Commits, Add to Candidates
        const nextList = todayCommits.filter(i => i.id !== id);
        setTodayCommits(nextList);

        // Auto-promote
        if (executionItem?.id === id) {
            setExecutionItem(nextList.length > 0 ? nextList[0] : null);
        }

        // Add to candidates (needs pseudo item or find from cache)
        // Ideally we fetch, but for optimistic UI let's try to preserve
        // We might lose some data if we just filter, but refreshToday will fix.

        try {
            // Update status to 'ready' (Candidate)
            await JBWOSRepository.updateItem(id, { status: 'ready' });
            // refreshToday(); // Removed
        } catch (e) {
            console.error('Uncommit failed', e);
            refreshToday();
        }
    };

    const updateItemTitle = async (id: string, newTitle: string) => {
        // Optimistic
        if (executionItem?.id === id) setExecutionItem({ ...executionItem, title: newTitle });
        setTodayCommits(prev => prev.map(i => i.id === id ? { ...i, title: newTitle } : i));
        setTodayCandidates(prev => prev.map(i => i.id === id ? { ...i, title: newTitle } : i));

        try {
            await JBWOSRepository.updateItem(id, { title: newTitle });
        } catch (e) {
            console.error('Update Title failed', e);
            refreshToday();
        }
    };

    // Legacy / Shared Actions (ThrowIn to GDB Inbox)
    const throwIn = async (title: string) => {
        if (!title.trim()) return null;

        // 1. Optimistic Update (Immediate Feedback)
        // We don't have the ID yet if we wait for repo, but repo generates it client-side? 
        // JBWOSRepository.addItemToInbox generates ID. But we need it to update state.
        // Let's assume we can get it or generate temp one?
        // Actually JBWOSRepository.addItemToInbox returns the ID.
        // We can wait for that (fast local gen) then update state, OR update with temp ID then replace.
        // Since Repo generates UUID synchronously (practically), checking the code...
        // repository says `const id = uuidv4(); await ApiClient... return id;`
        // So we have to wait for the API call in current Repo impl? 
        // Wait, Repo implementation in Step 2225:
        // `const id = uuidv4(); ... await ApiClient.createItem(newItem); return id;`
        // It awaits API call. This causes the delay.

        // Better: Generate ID here or split Repo method?
        // For minimal change safest approach:
        // Since `uuid` is not imported here, we rely on Repo.
        // But preventing delay means we shouldn't await API.

        // Let's rely on the fact that we can add it to state AFTER ID return (if fast enough)
        // OR better: Create a "Pending" item if we want true instant.
        // But the user issue is "Saved" (Toast) appears but list is empty.
        // Toast appears AFTER await. So if we update state AFTER await (but BEFORE refresh), it should show up.
        // The problem is likely `refreshGdb()` takes time or returns old data (race).

        // So:
        const id = await JBWOSRepository.addItemToInbox(title);

        // 2. Update Local State Manually (Optimistic-ish, Post-Creation)
        const newItem: Item = {
            id,
            title,
            status: 'inbox',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            statusUpdatedAt: Date.now(),
            // Defaults
            weight: 1,
            interrupt: false,
            doorId: '',
            category: 'door', // Default category
            type: 'start',
            memo: '',
            projectId: undefined
        };

        setGdbActive(prev => [newItem, ...prev]);

        // refreshGdb(); // Prevent flicker
        return id;
    };

    // [NEW] Update Preparation Date (Blurry Target)
    const updatePreparationDate = async (id: string, date: number | null) => {
        const newStatus = date ? 'scheduled' : 'inbox';

        // Optimistic: Find and Move
        const allItems = [...gdbActive, ...gdbPreparation];
        const item = allItems.find(i => i.id === id);
        console.log(`[ViewModel] updatePreparationDate: ID=${id} Date=${date} Found=${!!item} CurrentPrep=${item?.prep_date}`);


        if (item) {
            const updatedItem = { ...item, prep_date: date, status: newStatus as any };

            if (date) {
                // Move to Preparation
                setGdbActive(prev => prev.filter(i => i.id !== id));
                setGdbPreparation(prev => {
                    const exists = prev.find(i => i.id === id);
                    return exists ? prev.map(i => i.id === id ? updatedItem : i) : [...prev, updatedItem];
                });
            } else {
                // Move to Active
                setGdbPreparation(prev => prev.filter(i => i.id !== id));
                setGdbActive(prev => {
                    const exists = prev.find(i => i.id === id);
                    return exists ? prev.map(i => i.id === id ? updatedItem : i) : [updatedItem, ...prev];
                });
            }
        }

        try {
            await JBWOSRepository.updateItem(id, { prep_date: date, status: newStatus as any });
            // refreshGdb(); // Keep optimistic
        } catch (e) {
            console.error('Update Prep Date failed', e);
            refreshGdb();
        }
    };

    const updateItem = async (id: string, updates: Partial<Item>) => {
        // Helper to update a list
        const updateList = (list: Item[]) => list.map(item => item.id === id ? { ...item, ...updates } : item);

        // Optimistic Updates across all lists
        setTodayCandidates(prev => updateList(prev));
        setTodayCommits(prev => updateList(prev));
        setGdbActive(prev => updateList(prev));
        setGdbPreparation(prev => updateList(prev));
        setGdbIntent(prev => updateList(prev));

        // Update Execution Item if active
        if (executionItem && executionItem.id === id) {
            setExecutionItem(prev => prev ? { ...prev, ...updates } : null);
        }

        try {
            await JBWOSRepository.updateItem(id, updates);
        } catch (e) {
            console.error('Failed to update item:', e);
            // Optionally revert here, but for MVP keep simple
        }
    };

    // --- Capacity & Holiday ---
    const [capacityConfig, setCapacityConfig] = useState<CapacityConfig>({
        defaultDailyMinutes: 480,
        holidays: [{ type: 'weekly', value: '0' }], // Default Sunday
        exceptions: {}
    });

    const updateCapacityConfig = async (newConfig: CapacityConfig) => {
        setCapacityConfig(newConfig);
        // Persist to Settings API (Future)
        // For now, local state only or mock persistence
    };

    // [NEW] Sub-Task Actions
    const createSubTask = async (parentId: string, title: string): Promise<string | undefined> => {
        if (!title.trim()) return;

        // Uses the same create logic but with parentId
        const newItem: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'statusUpdatedAt'> = {
            title,
            status: 'inbox',
            parentId,
            // Defaults
            weight: 1,
            interrupt: false,
            category: 'subtask',
            type: 'generic'
        };

        try {
            const id = await JBWOSRepository.createItem(newItem);
            // Trigger global refresh so all views update
            window.dispatchEvent(new Event('jbwos-data-changed'));
            return id;
        } catch (e) {
            console.error('Failed to create subtask', e);
        }
    };

    // [NEW] Get Sub-Tasks (Directly from Repo for now, often used in Modal)
    const getSubTasks = useCallback(async (parentId: string) => {
        return await JBWOSRepository.getSubTasks(parentId);
    }, []);

    return {
        // State
        gdbActive,
        gdbPreparation,
        gdbIntent,
        gdbLog,
        todayCandidates,
        todayCommits,
        executionItem,
        memos,
        error,
        capacityConfig, // New state

        // Actions
        refresh: refreshAll,
        resolveDecision,
        commitToToday,
        completeItem,
        deleteItem,
        returnToInbox,
        updateItemTitle,
        prioritizeTask,
        uncommitFromToday,
        updatePreparationDate,
        updateItem, // [NEW] Generic Update
        updateCapacityConfig, // New action

        // Memo Actions
        addSideMemo,
        deleteSideMemo,
        memoToInbox,

        // Project Actions [NEW]
        createSubTask,
        getSubTasks,

        // Helpers
        throwIn,
        clearError: () => setError(null)
    };
};
