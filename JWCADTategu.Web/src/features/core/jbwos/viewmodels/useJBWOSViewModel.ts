import { useState, useEffect, useCallback } from 'react';
import { JBWOSRepository } from '../repositories/JBWOSRepository';
import { CloudJBWOSRepository } from '../repositories/CloudJBWOSRepository'; // [NEW]
import { Item, SideMemo, CapacityConfig } from '../types';
import { useUndo } from '../contexts/UndoContext';
import { ManufacturingBus } from '../logic/ManufacturingBus';
import { getDailyCapacity, isHoliday } from '../logic/capacity';

const getUseCloud = () => {
    // Enforce Cloud Mode by default (User Request)
    // return localStorage.getItem('JBWOS_USE_CLOUD') === 'true';
    return true;
};

// Simple Repository Proxy/Factory
const getRepository = () => {
    return getUseCloud() ? CloudJBWOSRepository : JBWOSRepository;
};


export const useJBWOSViewModel = () => {
    // Phase 2: Dumb UI ViewModel (Server is the Brain)

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
            const shelf = await getRepository().getGdbShelf();
            console.log('[ViewModel] Fetched GDB Shelf:', shelf); // [DEBUG]
            if (!shelf) throw new Error('Shelf is null');

            setGdbActive((Array.isArray(shelf.active) ? shelf.active : []).filter(Boolean));
            setGdbPreparation((Array.isArray(shelf.preparation) ? shelf.preparation : []).filter(Boolean)); // Migrated from hold
            setGdbIntent((Array.isArray(shelf.intent) ? shelf.intent : []).filter(Boolean)); // [NEW]
            setGdbLog((Array.isArray(shelf.log) ? shelf.log : []).filter(Boolean));
        } catch (e) {
            console.error('Failed to fetch GDB:', e);
            // Fallback to clear
            setGdbActive([]);
            setGdbPreparation([]);
            setGdbIntent([]);
            setGdbLog([]);
        }
    }, []);

    const refreshToday = useCallback(async () => {
        try {
            const today = await getRepository().getTodayView();
            setTodayCommits(today.commits || []);
            setExecutionItem(today.execution || null);
            setTodayCandidates(today.candidates || []);
        } catch (e) {
            console.error('Failed to fetch Today:', e);
        }
    }, []);

    const refreshMemos = useCallback(async () => {
        try {
            const data = await getRepository().getMemos();
            setMemos(data);
        } catch (e) {
            console.error('Failed to fetch Memos:', e);
        }
    }, []);

    // --- Capacity & Holiday ---
    const [capacityConfig, setCapacityConfig] = useState<CapacityConfig>({
        defaultDailyMinutes: 480,
        holidays: [{ type: 'weekly', value: '0' }], // Default Sunday
        exceptions: {}
    });
    // const capacityConfig = { defaultDailyMinutes: 480, holidays: [], exceptions: {} }; // Mock for safe render

    const refreshCapacityConfig = useCallback(async () => {
        try {
            const config = await getRepository().getCapacityConfig();
            if (config) {
                setCapacityConfig(config);
            }
        } catch (e) {
            console.error('Failed to load Capacity Config:', e);
        }
    }, []);

    const updateCapacityConfig = async (newConfig: CapacityConfig) => {
        // Optimistic
        setCapacityConfig(newConfig);
        try {
            await getRepository().saveCapacityConfig(newConfig);
        } catch (e) {
            console.error('Failed to save Capacity Config:', e);
        }
    };

    // [NEW] Toggle Holiday Logic (Expert Meeting Spec)
    // [NEW] Toggle Holiday Logic (Expert Meeting Spec)
    const toggleHoliday = async (date: Date) => {
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        const currentCapacity = getDailyCapacity(date, capacityConfig);
        const isCurrentlyHoliday = currentCapacity === 0;

        let newExceptions = { ...capacityConfig.exceptions };

        if (isCurrentlyHoliday) {
            // Holiday -> Work Day (Override)
            // If it was an explicit exception (0), remove it to restore default.
            // If it is a weekly holiday, we must Add exception (>0).
            const isWeekly = isHoliday(date, { ...capacityConfig, exceptions: {} }); // Check base rule

            if (newExceptions[dateStr] === 0) {
                // It was manually set to holiday. Just remove exception to restore base rule.
                delete newExceptions[dateStr];
                // But if base rule makes it holiday (e.g. Sunday), removing exception 0 leaves it as holiday.
                // We want to force it WORK.
                if (isWeekly) {
                    newExceptions[dateStr] = capacityConfig.defaultDailyMinutes; // Force Work
                }
            } else if (isWeekly) {
                // It is holiday by weekly rule. Add exception to Work.
                newExceptions[dateStr] = capacityConfig.defaultDailyMinutes;
            }
            // If neither (it was 0 by some other magic?), set to default.
        } else {
            // Work Day -> Holiday
            // Simply add exception = 0
            newExceptions[dateStr] = 0;
        }

        const newConfig = { ...capacityConfig, exceptions: newExceptions };
        await updateCapacityConfig(newConfig);
    };

    const refreshAll = useCallback(() => {
        refreshGdb();
        refreshToday();
        refreshMemos();
        refreshMemos();
        refreshCapacityConfig();
    }, [refreshGdb, refreshToday, refreshMemos, refreshCapacityConfig]);

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
    const resolveDecision = async (id: string, decision: 'yes' | 'hold' | 'no', _note?: string, updates?: Partial<Item>) => {
        // Optimistic Update: Remove from Active immediate
        setGdbActive(prev => prev.filter(i => i.id !== id));

        // [New] Apply updates optimistically if provided
        if (updates) {
            // ...
        }

        // const newStatus = decision === 'yes' ? 'focus' : decision === 'hold' ? 'pending' : 'done';

        // [Undo] Register Action
        addUndoAction({
            type: 'decision',
            id,
            previousStatus: 'inbox',
            description: `「${decision === 'yes' ? 'Yes' : decision === 'hold' ? 'Pending' : 'Done'}」と判断しました`
        });

        try {
            // [FIX] Apply updates FIRST
            if (updates && Object.keys(updates).length > 0) {
                await getRepository().updateItem(id, updates);
            }

            // Backend likely needs update to accept 'pending' instead of 'hold' logic?
            // Repository.resolveDecision might map it.
            // But we should send status update explicitly if we want strict control.
            // For now, assume Repository is smart or updated.
            if (decision === 'hold') {
                await getRepository().updateItem(id, { status: 'pending' });
            } else if (decision === 'yes') {
                await getRepository().updateItem(id, { status: 'focus' });
            } else {
                await getRepository().updateItem(id, { status: 'done' }); // or delete? user wants "finished decision"
            }

            // await getRepository().resolveDecision(id, decision, note); // Legacy API might be confusing?
            // Let's rely on standard updateItem for Status Model.

            refreshAll();
        } catch (e) {
            console.error('Decision failed:', e);
            setError('判断の保存に失敗しました。リロードしてください。');
            refreshAll();
        }
    };

    // 2. Commit to Today
    const commitToToday = async (id: string) => {
        // Guard: Client-side check for UI feedback (Strict 2 item limit)
        if (todayCommits.length >= 2) {
            setError('今日はもう手一杯です（最大2件）');
            return;
        }

        // Optimistic: Move from Candidate to Commit
        const target = todayCandidates.find(i => i.id === id);
        if (target) {
            setTodayCandidates(prev => prev.filter(i => i.id !== id));
            // Flag logic: existing status (focus) + is_today_commit flag
            const updated = { ...target, flags: { ...target.flags, is_today_commit: true } };
            setTodayCommits(prev => [...prev, updated]);
        }

        // [Undo] Register Action
        addUndoAction({
            type: 'decision',
            id,
            previousStatus: 'focus', // was focus
            description: '今日やること(Commit)に追加しました'
        });

        try {
            // We update the FLAG, not the status to 'today_commit'
            await getRepository().updateItem(id, {
                status: 'focus',
                flags: { is_today_commit: true } // Now valid without cast
            });
            refreshToday();
        } catch (e) {
            console.error('Commit failed:', e);
            setError('コミットに失敗しました。');
            refreshToday();
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
            previousStatus: 'focus' as any, // Logic: commited was focus+flag
            description: 'タスクを完了しました'
        });

        try {
            await getRepository().completeItem(id);
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
        await getRepository().createMemo(content);
        refreshMemos();
    };

    const deleteSideMemo = async (id: string) => {
        setMemos(prev => prev.filter(m => m.id !== id));
        // Todo: Undo implementation for Memo
        await getRepository().deleteMemo(id);
    };

    const memoToInbox = async (id: string) => {
        setMemos(prev => prev.filter(m => m.id !== id));

        // [Undo] Not implemented yet for Memo transfer

        await getRepository().moveMemoToInbox(id);
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
            await getRepository().deleteItem(id);
        } catch (e) {
            console.error('Delete item failed', e);
            refreshGdb();
        }
    };

    const returnToInbox = async (id: string, _currentStatus: string = 'focus') => {
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
            previousStatus: 'focus' as any, // was focus+flag
            description: 'Inboxに戻しました'
        });

        try {
            // Remove Today Commit Flag, Set to Inbox
            // Note: If returning strictly to inbox, we remove flags.
            await getRepository().updateItem(id, {
                status: 'inbox',
                is_boosted: false,
                flags: { is_today_commit: false }
            });
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
            await getRepository().startExecution(id);
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
            // Update status to 'focus' (Candidate)
            await getRepository().updateItem(id, { status: 'focus' });
            // refreshToday(); // Removed
        } catch (e) {
            console.error('Uncommit failed', e);
            refreshToday();
        }
    };

    // [NEW] Robust Start (Commit + Prioritize Atomic Operation)
    const startImmediately = async (id: string) => {
        // 1. Client-side check
        // If already in commits, just prioritize
        const inCommits = todayCommits.find(i => i.id === id);
        if (inCommits) {
            await prioritizeTask(id);
            return;
        }

        // 2. Optimistic: Commit + Prioritize
        const target = todayCandidates.find(i => i.id === id);
        if (target) {
            // Remove from Candidates
            setTodayCandidates(prev => prev.filter(i => i.id !== id));
            // Add to Commits at TOP
            const newItem = { ...target, status: 'focus', flags: { ...target.flags, is_today_commit: true } } as any;
            setTodayCommits(prev => [newItem, ...prev.filter(i => i.id !== id)]); // Prepend
            // Set Execution Item
            setExecutionItem(newItem);
        }



        // 3. Server Interaction
        try {
            // Commit (Flag) + Start (Execution)
            await getRepository().updateItem(id, {
                status: 'focus',
                flags: { is_today_commit: true }
            });
            await getRepository().startExecution(id);
            refreshToday();
        } catch (e) {
            console.error('Start Immediately failed', e);
            setError('開始に失敗しました');
            refreshToday();
        }
    };

    const updateItemTitle = async (id: string, newTitle: string) => {
        // Optimistic
        if (executionItem?.id === id) setExecutionItem({ ...executionItem, title: newTitle });
        setTodayCommits(prev => prev.map(i => i.id === id ? { ...i, title: newTitle } : i));
        setTodayCandidates(prev => prev.map(i => i.id === id ? { ...i, title: newTitle } : i));

        try {
            await getRepository().updateItem(id, { title: newTitle });
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
        const id = await getRepository().addItemToInbox(title);

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
            projectId: undefined,
            focusOrder: 0,
            isIntent: false
        };

        setGdbActive(prev => [newItem, ...prev]);

        // refreshGdb(); // Prevent flicker
        return id;
    };

    // [NEW] Update Preparation Date (Blurry Target)
    const updatePreparationDate = async (id: string, date: number | null) => {
        // Haruki Model: Future date = Ready (with prep_date). No date = Inbox.
        const newStatus = date ? 'focus' : 'inbox';

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
            await getRepository().updateItem(id, { prep_date: date, status: newStatus as any });
            // refreshGdb(); // Keep optimistic
        } catch (e) {
            console.error('Update Prep Date failed', e);
            refreshGdb();
        }
    };

    // [NEW] Move to Someday (Intent) -> PENDING
    const moveToSomeday = async (id: string) => {
        // Optimistic: Remove from Active/Prep, Add to Intent
        const allItems = [...gdbActive, ...gdbPreparation];
        const item = allItems.find(i => i.id === id);

        if (item) {
            const updatedItem = { ...item, status: 'pending' as const };

            setGdbActive(prev => prev.filter(i => i.id !== id));
            setGdbPreparation(prev => prev.filter(i => i.id !== id));
            setGdbIntent(prev => [updatedItem, ...prev]);

            // [Undo] Register Action
            addUndoAction({
                type: 'decision', // treat as decision
                id,
                previousStatus: item.status as any,
                description: '保留(Pending)へ移動しました'
            });

            try {
                await getRepository().updateItem(id, { status: 'pending' });
            } catch (e) {
                console.error('Move to Pending failed', e);
                refreshGdb();
            }
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
            await getRepository().updateItem(id, updates);
        } catch (e) {
            console.error('Failed to update item:', e);
            // Optionally revert here, but for MVP keep simple
        }
    };





    // ... (rest of the file) ...

    // [NEW] Sub-Task Actions
    const createSubTask = async (parentId: string, title: string, initialDueDate?: string, domain: 'business' | 'general' | 'private' = 'general'): Promise<string | undefined> => { // [FIX] Added initialDueDate & domain
        if (!title.trim()) return;

        // Uses the same create logic but with parentId
        const newItem: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'statusUpdatedAt'> = {
            title,
            status: 'inbox',
            parentId,
            due_date: initialDueDate, // [NEW] Inherit due date
            // Defaults
            weight: 1,
            interrupt: false,
            category: 'subtask',
            type: 'generic',
            domain, // [NEW] Link domain
            focusOrder: 0,
            isIntent: false
        };

        try {
            const id = await getRepository().createItem(newItem);
            // Trigger global refresh so all views update
            window.dispatchEvent(new Event('jbwos-data-changed'));
            return id;
        } catch (e) {
            console.error('Failed to create subtask', e);
        }
    };

    // [NEW] Get Sub-Tasks (Directly from Repo for now, often used in Modal)
    const getSubTasks = useCallback(async (parentId: string) => {
        return await getRepository().getSubTasks(parentId);
    }, []);

    // [NEW] Delegation Actions
    const delegateTask = async (taskId: string, assignedTo: string, dueDate?: string, note?: string) => {
        const assigneeName = assignedTo; // In real implementation, get name from AssigneeManager

        await updateItem(taskId, {
            status: 'waiting',
            waitingReason: `${assigneeName}の作業待ち`,
            assignedTo,
            delegation: {
                assignedTo,
                assignedAt: Date.now(),
                dueDate,
                note
            }
        });

        refreshAll();
    };

    const reportDelegationCompletion = async (taskId: string) => {
        const item = [...gdbActive, ...gdbPreparation].find(i => i.id === taskId);
        if (!item?.delegation) return;

        await updateItem(taskId, {
            delegation: {
                ...item.delegation,
                completedAt: Date.now()
            }
        });

        refreshAll();
    };

    const confirmDelegationCompletion = async (taskId: string) => {
        await updateItem(taskId, {
            status: 'done'
        });

        refreshAll();
    };

    // [NEW] Project Creation
    const createProject = async (project: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'statusUpdatedAt'>, defaultTasks: any[]) => {
        // Resolve Domain based on Category if not provided
        let domain = project.domain;
        if (!domain && project.projectCategory) {
            // In a real app, we'd fetch the category. For now, we assume caller or default.
            // But actually, we can check basic logic:
            // If category is 'general', domain='general'.
            // If caller passed domain, use it.
            if (!domain) domain = 'general'; // Fallback
        }

        // Create project item
        const projectItem: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'statusUpdatedAt'> = {
            ...project,
            type: 'project',     // Explicitly set type as project
            isProject: true,     // Flag
            domain: domain || 'general',
            status: 'inbox',      // Default to inbox
            focusOrder: 0,
            isIntent: false
        };

        const projectId = await getRepository().createItem(projectItem);

        // Create default tasks as subtasks
        for (const task of defaultTasks) {
            // Inherit domain from project
            await createSubTask(projectId, task.title, undefined, domain);
        }

        refreshAll();
        return projectId;
    };

    // [NEW] Import from Plugin (Future Board Drag & Drop)
    const importFromPlugin = async (sourceId: string, itemId: string, date: number) => {
        // 1. Fetch source item details (via Bus)
        const sources = await ManufacturingBus.getSources();
        const source = sources.find(s => s.id === sourceId);
        const item = source?.items.find(i => i.id === itemId);

        if (!item) {
            console.error('Import failed: Source item not found', sourceId, itemId);
            return;
        }

        // 2. Create JBWOS Item
        const newItem: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'statusUpdatedAt'> = {
            title: item.title, // Use title from external source
            status: 'focus',   // Haruki Model: Imported to Scheduled = Ready
            prep_date: date,
            // Defaults
            weight: 1,
            interrupt: false,
            category: 'import',
            type: 'generic',
            memo: `Imported from ${source?.name}`,
            focusOrder: 0,
            isIntent: false
        };

        try {
            await getRepository().createItem(newItem);
            refreshAll(); // Refresh to show new item
            console.log('Import successful', item.title);
        } catch (e) {
            console.error('Import failed', e);
        }
    };

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
        startImmediately, // [NEW]
        updatePreparationDate,
        moveToSomeday, // [NEW]
        toggleHoliday, // [NEW] Exported
        updateItem, // [NEW] Generic Update
        updateCapacityConfig, // New action

        // Memo Actions
        addSideMemo,
        deleteSideMemo,
        memoToInbox,

        // Project Actions [NEW]
        createSubTask,
        getSubTasks,
        createProject,

        // Plugin Import [NEW]
        importFromPlugin,

        // Delegation Actions [NEW]
        delegateTask,
        reportDelegationCompletion,
        confirmDelegationCompletion,

        // Helpers
        throwIn,
        clearError: () => setError(null)
    };
};
