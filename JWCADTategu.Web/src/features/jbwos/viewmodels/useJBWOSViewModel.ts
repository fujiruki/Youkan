import { useState, useEffect, useCallback } from 'react';
import { JBWOSRepository } from '../repositories/JBWOSRepository';
import { Item, SideMemo } from '../types';

export const useJBWOSViewModel = () => {
    // Phase 2: Dumb UI ViewModel (Server is the Brain)

    // --- State (Aligned with v3.1 Zones) ---
    // GDB Shelf
    const [gdbActive, setGdbActive] = useState<Item[]>([]); // Inbox + Decision
    const [gdbHold, setGdbHold] = useState<Item[]>([]);
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
            setGdbHold(shelf.hold || []);
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

    // Initial Load
    useEffect(() => {
        refreshAll();
    }, [refreshAll]);

    // --- Optimistic Actions ---

    // 1. Decision (Yes/No/Hold)
    const resolveDecision = async (id: string, decision: 'yes' | 'hold' | 'no', note?: string) => {
        // Optimistic Update: Remove from Active immediate
        setGdbActive(prev => prev.filter(i => i.id !== id));

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
        await JBWOSRepository.deleteMemo(id);
    };

    const memoToInbox = async (id: string) => {
        setMemos(prev => prev.filter(m => m.id !== id));
        await JBWOSRepository.moveMemoToInbox(id);
        refreshGdb(); // Will appear in Inbox
    };

    const deleteItem = async (id: string) => {
        // Optimistic UI
        setGdbActive(prev => prev.filter(i => i.id !== id));
        setGdbHold(prev => prev.filter(i => i.id !== id));

        try {
            await JBWOSRepository.deleteItem(id);
        } catch (e) {
            console.error('Delete item failed', e);
            refreshGdb();
        }
    };

    // Legacy / Shared Actions (ThrowIn to GDB Inbox)
    const throwIn = async (title: string) => {
        if (!title.trim()) return null;
        const id = await JBWOSRepository.addItemToInbox(title);
        refreshGdb();
        return id;
    };

    return {
        // State
        gdbActive,
        gdbHold,
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

        // Helpers
        throwIn,
        clearError: () => setError(null)
    };
};
