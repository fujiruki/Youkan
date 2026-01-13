import { useState, useEffect, useCallback } from 'react';
import { JBWOSRepository } from '../repositories/JBWOSRepository';
import { Item, SideMemo } from '../types';
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
        // Optimistic: Remove from Today Commits immediately
        setTodayCommits(prev => prev.filter(i => i.id !== id));
        // Also remove from Execution (if it was top)
        if (executionItem?.id === id) setExecutionItem(null);

        // [Undo] Register Action (Revert to today_commit or execution?)
        // Assuming we revert to 'today_commit' which is the default for Today items.
        // If it was 'execution', it will just be available to execute again.
        addUndoAction({
            type: 'complete',
            id,
            previousStatus: 'today_commit',
            description: 'タスクを完了しました'
        });

        try {
            await JBWOSRepository.completeItem(id);
            refreshToday();
        } catch (e) {
            console.error('Complete failed:', e);
            setError('完了への移動に失敗しました。');
            refreshToday();
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

        try {
            await JBWOSRepository.deleteItem(id);
        } catch (e) {
            console.error('Delete item failed', e);
            refreshGdb();
        }
    };

    const returnToInbox = async (id: string, currentStatus: string = 'today_commit') => {
        // Optimistic: Remove from Today Commits / Candidates
        setTodayCommits(prev => prev.filter(i => i.id !== id));
        setTodayCandidates(prev => prev.filter(i => i.id !== id));

        if (executionItem?.id === id) setExecutionItem(null);

        // [Undo] Register Action
        addUndoAction({
            type: 'decision', // Treat as a status change
            id,
            previousStatus: currentStatus === 'today_commit' ? 'today_commit' : 'confirmed',
            description: 'Inboxに戻しました'
        });

        try {
            await JBWOSRepository.updateItem(id, { status: 'inbox', is_boosted: false }); // Reset boost too
            refreshGdb(); // It goes to Inbox
        } catch (e) {
            console.error('Return to Inbox failed', e);
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
        const id = await JBWOSRepository.addItemToInbox(title);
        refreshGdb();
        return id;
    };

    // [NEW] Update Preparation Date (Blurry Target)
    const updatePreparationDate = async (id: string, date: number | null) => {
        // Optimistic: Update in Preparation Lane (if visible)
        setGdbPreparation(prev => prev.map(i => i.id === id ? { ...i, prep_date: date } : i));

        try {
            await JBWOSRepository.updateItem(id, { prep_date: date });
            refreshGdb();
        } catch (e) {
            console.error('Update Prep Date failed', e);
            refreshGdb();
        }
    };

    return {
        // State
        gdbActive,
        gdbPreparation, // Renamed from hold
        gdbIntent,
        gdbLog,
        todayCandidates,
        todayCommits,
        executionItem,
        memos,
        error,

        // Actions
        refresh: refreshAll,
        resolveDecision, // The main GDB action
        commitToToday,   // The main Today action
        completeItem,    // [FIX] Exported

        // Memo Actions
        addSideMemo,
        deleteSideMemo,
        memoToInbox,
        deleteItem, // [NEW]
        returnToInbox, // [NEW] Flexibility
        updateItemTitle, // [NEW] Flexibility
        updatePreparationDate, // [NEW]

        // Helpers
        throwIn,
        clearError: () => setError(null)
    };
};
