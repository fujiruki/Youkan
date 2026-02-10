import { useState, useEffect, useCallback } from 'react';
import { JBWOSRepository } from '../repositories/JBWOSRepository';
import { CloudJBWOSRepository } from '../repositories/CloudJBWOSRepository'; // [NEW]
import { Item, SideMemo, CapacityConfig, Member, FilterMode } from '../types';
import { useUndo } from '../contexts/UndoContext';
import { ManufacturingBus } from '../logic/ManufacturingBus';
import { getDailyCapacity, isHoliday } from '../logic/capacity';
import { QuantityEngine } from '../logic/QuantityEngine';

const getUseCloud = () => {
    // Enforce Cloud Mode by default (User Request)
    // return localStorage.getItem('JBWOS_USE_CLOUD') === 'true';
    return true;
};

// Simple Repository Proxy/Factory
const getRepository = () => {
    return getUseCloud() ? CloudJBWOSRepository : JBWOSRepository;
};


export const useJBWOSViewModel = (projectId?: string) => {
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

    // [NEW] Members
    const [members, setMembers] = useState<Member[]>([]);

    // [NEW] All Projects & Tenants
    const [allProjects, setAllProjects] = useState<Item[]>([]);
    const [joinedTenants, setJoinedTenants] = useState<string[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // [NEW] Filter Mode (Public/Private Filtering - Option 3)
    const [filterMode, setFilterMode] = useState<FilterMode>(() => {
        const saved = localStorage.getItem('jbwos_filter_mode');
        return (saved === 'company' || saved === 'personal') ? saved as FilterMode : 'all';
    });

    // Loading & Error
    const [error, setError] = useState<string | null>(null);

    // --- Data Fetching ---
    const refreshGdb = useCallback(async (projectId?: string) => {
        try {
            const shelf = await getRepository().getGdbShelf(projectId);
            console.log('[ViewModel] Fetched GDB Shelf:', shelf, 'for project:', projectId); // [DEBUG]
            if (!shelf) throw new Error('Shelf is null');

            setGdbActive(
                (Array.isArray(shelf.active) ? shelf.active : [])
                    .filter(Boolean)
                    .filter(i => i.status !== 'focus') // [FIX] Strict View Separation: Exclude 'focus' from Inbox (already in Center)
            );
            setGdbPreparation((Array.isArray(shelf.preparation) ? shelf.preparation : []).filter(Boolean)); // Migrated from hold
            setGdbIntent((Array.isArray(shelf.intent) ? shelf.intent : []).filter(Boolean)); // [NEW]
            setGdbLog((Array.isArray(shelf.log) ? shelf.log : []).filter(Boolean));
        } catch (e) {
            console.error('Failed to fetch GDB:', e);
            // Fallback to clear
            setGdbActive(
                // [FIX] Strict View Separation: Exclude 'focus' items from Inbox (Active)
                // These are already shown in the Center (Focus/Queue) view.
                [] // Clear on error
            );
            setGdbPreparation([]);
            setGdbIntent([]);
            setGdbLog([]);
        }
    }, []);

    const refreshToday = useCallback(async () => {
        try {
            const today = await getRepository().getTodayView(projectId);
            setTodayCommits(today.commits || []);
            setExecutionItem(today.execution || null);
            setTodayCandidates(today.candidates || []);
        } catch (e) {
            console.error('Failed to fetch Today:', e);
        }
    }, [projectId]);

    const refreshMemos = useCallback(async () => {
        try {
            const data = await getRepository().getMemos();
            setMemos(data);
        } catch (e) {
            console.error('Failed to fetch Memos:', e);
        }
    }, []);

    // [NEW] Refresh context data
    // const refreshContextData = useCallback(async () => {
    //     // Fetching context-related data if needed in future
    // }, []);

    useEffect(() => {
        localStorage.setItem('jbwos_filter_mode', filterMode);
        // Dispatch global event
        window.dispatchEvent(new CustomEvent('jbwos-filter-change', { detail: { mode: filterMode } }));
        // [FIX] Trigger refresh when filter changes to avoid stale view
        refreshGdb(projectId);
    }, [filterMode, projectId, refreshGdb]);

    // Listen for global changes from other components
    useEffect(() => {
        const handleGlobalFilterChange = (e: any) => {
            const newMode = e.detail?.mode;
            if (newMode && newMode !== filterMode) {
                setFilterMode(newMode);
            }
        };
        window.addEventListener('jbwos-filter-change', handleGlobalFilterChange);
        return () => window.removeEventListener('jbwos-filter-change', handleGlobalFilterChange);
    }, [filterMode]);


    const refreshMembers = useCallback(async () => {
        try {
            const data = await getRepository().getMembers();
            setMembers(data);
        } catch (e) {
            console.error('Failed to fetch Members:', e);
        }
    }, []);

    const refreshContextMetadata = useCallback(async () => {
        try {
            // Fetch all projects for selection in modals
            const projs = await getRepository().getProjects('aggregated');
            setAllProjects(projs);

            // Fetch joined tenants
            const tenants = await getRepository().getJoinedTenants();
            // Ensure we only store IDs (strings) as per state type definition
            setJoinedTenants(tenants.map((t: any) => typeof t === 'string' ? t : t.id));

            // [NEW] Try to resolve currentUserId from repository
            // Many repositories expose a getCurrentUser or similar
            try {
                const user = await (getRepository() as any).getCurrentUser?.();
                if (user) setCurrentUserId(user.id);
            } catch (e) {
                console.warn('Failed to fetch current user id:', e);
            }
        } catch (e) {
            console.error('Failed to fetch context metadata:', e);
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

    const refreshAll = useCallback(async () => {
        await Promise.all([
            refreshGdb(projectId),
            refreshToday(),
            refreshMemos(),
            refreshMembers(),
            refreshCapacityConfig(),
            refreshContextMetadata()
        ]);
    }, [refreshGdb, refreshToday, refreshMemos, refreshMembers, refreshCapacityConfig, refreshContextMetadata, projectId]);

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
    const resolveDecision = async (id: string, decision: 'yes' | 'hold' | 'no', note?: string, updates?: Partial<Item>) => {
        const targetId = id.replace('virtual-header-', '');
        // Optimistic Update: Remove from Active immediate
        setGdbActive(prev => prev.filter(i => i.id !== id && i.id !== targetId));

        // [New] Apply updates optimistically if provided
        if (updates) {
            // ...
        }

        // [Undo] Register Action
        let statusLabel = decision === 'yes' ? 'Yes' : decision === 'hold' ? 'Pending' : 'Done';
        if (decision === 'no' && (note === 'someday' || note === 'intent')) statusLabel = 'Someday (保留)';

        addUndoAction({
            type: 'decision',
            id,
            previousStatus: 'inbox',
            description: `「${statusLabel}」と判断しました`
        });

        try {
            // [FIX] Apply updates FIRST
            if (updates && Object.keys(updates).length > 0) {
                await getRepository().updateItem(targetId, updates);
            }

            // [FIX] Status logic
            if (decision === 'hold') {
                await getRepository().updateItem(targetId, { ...updates, status: 'pending' });
            } else if (decision === 'yes') {
                await getRepository().updateItem(targetId, {
                    ...updates,
                    status: 'focus',
                    flags: { ...(updates?.flags || {}), is_today_commit: true }
                });
            } else if (decision === 'no' && (note === 'someday' || note === 'intent')) {
                // [NEW] Someday -> Pending (Shelf)
                await getRepository().updateItem(targetId, { ...updates, status: 'pending' });
            } else {
                await getRepository().updateItem(targetId, { ...updates, status: 'done' });
            }

            refreshAll();
        } catch (e) {
            console.error('Decision failed:', e);
            setError('判断の保存に失敗しました。リロードしてください。');
            refreshAll();
        }
    };

    // 2. Commit to Today
    const commitToToday = async (id: string) => {
        const targetId = id.replace('virtual-header-', '');
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
            await getRepository().updateItem(targetId, {
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
        const targetId = id.replace('virtual-header-', '');
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
            await getRepository().completeItem(targetId);
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

    // 4. Archive, Trash, Restore
    const archiveItem = async (id: string) => {
        const targetId = id.replace('virtual-header-', '');
        // Optimistic: Remove from all active lists
        const filter = (list: Item[]) => list.filter(i => i.id !== id && i.id !== targetId);
        setGdbActive(prev => filter(prev));
        setGdbPreparation(prev => filter(prev));
        setGdbIntent(prev => filter(prev));
        setTodayCandidates(prev => filter(prev));
        setTodayCommits(prev => filter(prev));
        if (executionItem?.id === id || executionItem?.id === targetId) setExecutionItem(null);

        // [Undo] Register Action
        addUndoAction({
            type: 'delete', // Treat as delete for undo purposes (restore)
            id,
            previousStatus: 'inbox', // Simplify
            description: 'アーカイブしました'
        });

        try {
            await getRepository().archiveItem(targetId);
        } catch (e) {
            console.error('Archive failed', e);
            refreshAll();
        }
    };

    const deleteItem = async (id: string) => { // UI calls this "Delete", effectively "Move to Trash"
        const targetId = id.replace('virtual-header-', '');
        // Find item to save for undo
        const allItems = [...gdbActive, ...gdbPreparation, ...gdbIntent, ...todayCandidates, ...todayCommits, ...allProjects];
        const itemToDelete = allItems.find(i => String(i.id) === String(id) || String(i.id) === String(targetId));

        if (itemToDelete) {
            // [Undo] Register Action
            addUndoAction({
                type: 'delete',
                id: String(id),
                previousData: itemToDelete,
                description: `「${itemToDelete.title}」をゴミ箱へ移動しました`
            });
        }

        // Optimistic UI
        const filter = (list: Item[]) => list.filter(i => String(i.id) !== String(id) && String(i.id) !== String(targetId));
        setGdbActive(prev => filter(prev));
        setGdbPreparation(prev => filter(prev));
        setGdbIntent(prev => filter(prev));
        setTodayCandidates(prev => filter(prev));
        setTodayCommits(prev => filter(prev));
        setAllProjects(prev => filter(prev)); // [NEW] Ensure projects are also removed
        if (executionItem?.id === String(id) || executionItem?.id === String(targetId)) setExecutionItem(null);

        try {
            await getRepository().trashItem(targetId); // [Changed] Use trash instead of delete
            if (itemToDelete?.isProject) {
                await refreshContextMetadata(); // [NEW] Refresh project list if it's a project
            }
        } catch (e) {
            console.error('Trash item failed', e);
            refreshAll();
        }
    };

    const restoreItem = async (id: string) => {
        // Optimistic: Hard to know where it goes back to without previous state.
        // Usually goes to Inbox.
        // We can wait for refresh or try to add to Inbox?
        // Let's just refresh for now as it's from distinct screen usually.
        try {
            await getRepository().restoreItem(id);
            refreshAll();
        } catch (e) {
            console.error('Restore failed', e);
        }
    };

    const destroyItem = async (id: string) => {
        try {
            await getRepository().destroyItem(id);
            // No local state update needed if called from Trash Screen (separate state)
        } catch (e) {
            console.error('Destroy failed', e);
        }
    };

    const returnToInbox = async (id: string, _currentStatus: string = 'focus') => {
        const targetId = id.replace('virtual-header-', '');
        // Optimistically remove from today
        const nextList = todayCommits.filter(i => i.id !== id && i.id !== targetId);
        setTodayCommits(nextList);
        setTodayCandidates(prev => prev.filter(i => i.id !== id && i.id !== targetId));

        // Auto-promote
        if (executionItem?.id === id || executionItem?.id === targetId) {
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
            await getRepository().updateItem(targetId, {
                status: 'inbox',
                is_boosted: false,
                flags: { is_today_commit: false }
            });
            refreshAll();
        } catch (e) {
            console.error('Return to Inbox failed', e);
            refreshToday();
        }
    };

    // [NEW] Flexibility: Prioritize (Wait -> Active)
    const prioritizeTask = async (id: string) => {
        const targetId = id.replace('virtual-header-', '');
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
            await getRepository().startExecution(targetId);
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

    // [NEW] Skip / Demote (Move to end of queue)
    const skipTask = async (id: string) => {
        // 1. If in Commits, uncommit first (demote to candidate)
        const inCommits = todayCommits.find(i => i.id === id);
        if (inCommits) {
            await uncommitFromToday(id);
            setTodayCandidates(prev => {
                const updated = { ...inCommits, status: 'focus', flags: { ...inCommits.flags, is_today_commit: false } } as any;
                return [...prev, updated];
            });
            return;
        }

        // 2. If in Candidates, rotate to end
        const inCandidates = todayCandidates.find(i => i.id === id);
        if (inCandidates) {
            setTodayCandidates(prev => {
                const others = prev.filter(i => i.id !== id);
                return [...others, inCandidates];
            });

            // Auto-promote
            if (executionItem?.id === id) {
                const others = todayCandidates.filter(i => i.id !== id);
                const nextTop = others.length > 0 ? others[0] : null;
                setExecutionItem(todayCommits.length > 0 ? todayCommits[0] : nextTop);
            }
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
    // [NEW] initialStatus: 'inbox' (default) or 'focus' (Ctrl+Enter)
    const throwIn = async (title: string, tenantId?: string | null, targetProjectId?: string | null, initialStatus: 'inbox' | 'focus' = 'inbox') => {
        if (!title.trim()) return null; // Empty check

        // [FIX] Resolve Project ID:
        // Use targetProjectId if explicitly provided (including null), otherwise fallback to scope projectId
        const activeProjectId = targetProjectId !== undefined ? targetProjectId : projectId;

        // [FIX] Resolve Tenant ID: 
        // 1. If tenantId explicitly provided -> Use it.
        // 2. If Project Focused -> Use Project's Tenant ID.
        // 3. Else (Inbox) -> Default to PRIVATE (null).
        let resolvedTenantId: string | null | undefined = tenantId;

        if (!resolvedTenantId && activeProjectId) {
            const p = allProjects.find(pro => pro.id === activeProjectId);
            if (p) resolvedTenantId = p.tenantId || null;
        }

        // Ensure we pass null if we want Private, NOT some accidental company ID.
        if (!resolvedTenantId && !activeProjectId) resolvedTenantId = null;

        // [NEW] Find Project Metadata for Optimistic UI
        let projectTitle = undefined;
        if (activeProjectId) {
            const p = allProjects.find(pro => pro.id === activeProjectId);
            if (p) {
                projectTitle = p.title;
            }
        }

        // [NEW] Find Tenant Metadata for Optimistic UI
        let tenantName = undefined;
        if (resolvedTenantId) {
            // joinedTenants is now string[], find doesn't apply to objects here anymore.
            // If we need the name, we should fetch it from elsewhere, but for now ID = Name fallback or just check existence.
            const exists = joinedTenants.includes(resolvedTenantId);
            if (exists) tenantName = `Tenant ${resolvedTenantId.substring(0, 4)}`;
        }

        // 1. Optimistic Update (Immediate Feedback)
        // [NEW] Pass initialStatus to API
        const id = await getRepository().addItemToInbox(title, resolvedTenantId, activeProjectId || null, initialStatus);

        // 2. Update Local State Manually (Optimistic-ish, Post-Creation)
        const newItem: Item = {
            id,
            title,
            status: initialStatus, // [NEW] Use initialStatus
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
            tenantId: resolvedTenantId, // [NEW] Link context
            tenantName, // [NEW] Optimistic Tenant Name
            projectId: activeProjectId || null, // [FIX] Use explicit null
            projectTitle, // [NEW] Optimistic Project Title
            focusOrder: 0,
            isEngaged: false
        };

        // [NEW] Add to appropriate list based on status
        if (initialStatus === 'focus') {
            setTodayCandidates(prev => [newItem, ...prev]);
        } else {
            setGdbActive(prev => [newItem, ...prev]);
        }

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

    const setEngaged = async (id: string, isEngaged: boolean) => {
        // Optimistic
        const updates = {
            isEngaged,
            status: isEngaged ? 'focus' : undefined,
            flags: { is_today_commit: true } // [FIX] Ensure it appears in Today Commits
        } as Partial<Item>;

        // [FIX] List Movement Logic
        const allLocal = [...gdbActive, ...gdbPreparation, ...gdbIntent, ...todayCandidates, ...todayCommits];
        const target = allLocal.find(i => i.id === id);

        if (target) {
            const updatedItem = { ...target, ...updates };

            // 1. Remove from ALL lists first
            setGdbActive(prev => prev.filter(i => i.id !== id));
            setGdbPreparation(prev => prev.filter(i => i.id !== id));
            setGdbIntent(prev => prev.filter(i => i.id !== id));
            setTodayCandidates(prev => prev.filter(i => i.id !== id));
            setTodayCommits(prev => prev.filter(i => i.id !== id));

            // 2. Add to appropriate list
            if (isEngaged) {
                // Add to Today Commits
                setTodayCommits(prev => [updatedItem, ...prev]);
                // Update Execution Item
                setExecutionItem(updatedItem);
            } else {
                // Return to Inbox? or just Focus (Candidate)?
                // If checking OFF, usually implies -> Candidate or Inbox.
                // For now, assume Candidate (Focus)
                setTodayCandidates(prev => [updatedItem, ...prev]);
                if (executionItem?.id === id) setExecutionItem(null);
            }
        }

        try {
            // Map 'isEngaged' back to 'isIntent' for API compatibility
            await getRepository().updateItem(id, {
                isIntent: isEngaged,
                status: isEngaged ? 'focus' : undefined,
                dueStatus: isEngaged ? 'today' : undefined,
                flags: { is_today_commit: true } // [FIX] Persist
            } as any);
        } catch (e) {
            console.error('Set Engaged failed', e);
            refreshToday();
            refreshGdb();
        }
    };

    const updateItem = async (id: string, updates: Partial<Item>) => {
        // [NEW] Resolve Persistence Names related to IDs (Immediate UI Feedback)
        // Check for existence of key to handle clearing (null/undefined)
        if ('projectId' in updates) {
            if (updates.projectId) {
                const p = allProjects.find(pro => pro.id === updates.projectId);
                if (p) {
                    (updates as any).projectTitle = p.title;
                    // Auto-sync tenant if project has one and tenantId isn't explicitly being set/cleared in this update
                    // This ensures "Project = X" implies "Tenant = X's Tenant" unless user overrides
                    if (!('tenantId' in updates) && p.tenantId) {
                        updates.tenantId = p.tenantId;
                    }
                }
            } else {
                // Clearing Project
                (updates as any).projectTitle = undefined;
                // We do NOT auto-clear tenant here, as item might remain in Company but lose Project.
            }
        }

        // Handle Tenant Updates (including those set by Project logic above)
        if ('tenantId' in updates) {
            if (updates.tenantId) {
                const exists = joinedTenants.includes(updates.tenantId);
                if (exists) (updates as any).tenantName = `Tenant ${updates.tenantId.substring(0, 4)}`;
            } else {
                // Clearing Tenant (Private)
                (updates as any).tenantName = undefined;
            }
        }

        // [FIX] Lists Selection & Movement Logic
        const allLocal = [...gdbActive, ...gdbPreparation, ...gdbIntent, ...todayCandidates, ...todayCommits];
        const target = allLocal.find(i => i.id === id);

        if (target) {
            const updatedItem = { ...target, ...updates };

            // Determine Destination List based on Status
            const newStatus = updates.status || target.status;

            // If status changed, we need to MOVE
            if (newStatus !== target.status) {
                // Remove from OLD
                setGdbActive(prev => prev.filter(i => i.id !== id));
                setGdbPreparation(prev => prev.filter(i => i.id !== id));
                setGdbIntent(prev => prev.filter(i => i.id !== id));
                setTodayCandidates(prev => prev.filter(i => i.id !== id));
                setTodayCommits(prev => prev.filter(i => i.id !== id));

                // Add to NEW
                if (newStatus === 'inbox') setGdbActive(prev => [updatedItem, ...prev]);
                else if (newStatus === 'pending') setGdbActive(prev => [updatedItem, ...prev]); // Pending stays in GDB Active shelf usually? Or separate? 
                // Wait, useJBWOSViewModel separates Active (Inbox) and Pending?
                // Looking at init: gdbActive is Inbox+Decision. 
                // Let's stick to: Inbox->Active, Pending->Active (or Intent/Prep if designated).
                // Actually GDB Active usually holds Inbox & Pending.
                else if (newStatus === 'focus') {
                    // Focus means Candidate OR Commit (if today flag)
                    // We assume Candidate by default for simple 'focus' update
                    setTodayCandidates(prev => [updatedItem, ...prev]);
                }
            } else {
                // Just property update, no move (except maybe sort order?)
                const updateList = (list: Item[]) => list.map(item => item.id === id ? { ...item, ...updates } : item);
                setTodayCandidates(prev => updateList(prev));
                setTodayCommits(prev => updateList(prev));
                setGdbActive(prev => updateList(prev));
                setGdbPreparation(prev => updateList(prev));
                setGdbIntent(prev => updateList(prev));
            }

            // Update Execution Item if active
            if (executionItem && executionItem.id === id) {
                setExecutionItem(prev => prev ? { ...prev, ...updates } : null);
            }
        }

        // [Haruki Model] Translate virtual header IDs back to real item (project) IDs
        // This ensures projects can be updated just like any other item.
        const targetId = id.replace('virtual-header-', '');

        try {
            await getRepository().updateItem(targetId, updates);
            // [NEW] If project status changed, refresh the projects list so headers update
            if ('isProject' in updates) {
                await refreshContextMetadata();
            }
        } catch (e) {
            console.error('Failed to update item:', e);
            // Optionally revert here, but for MVP keep simple
        }
    };





    // --- JBWOS v2: View Matrix Context ---
    const getQuantityContext = useCallback((): any => {
        // [Haruki Model] Detect if Company or Person
        const accountId = localStorage.getItem('jbwos_account_id') || '';
        const isCompanyAcc = accountId.length > 20; // Rough check (UUID length vs individual short IDs)

        return {
            items: [...gdbActive, ...gdbPreparation, ...gdbIntent, ...todayCandidates, ...todayCommits],
            members,
            capacityConfig,
            filterMode,
            focusedTenantId: projectId ? (allProjects.find(p => p.id === projectId)?.tenantId || null) : null,
            focusedProjectId: projectId,
            currentUser: {
                id: accountId,
                isCompanyAccount: isCompanyAcc,
                joinedTenants: joinedTenants.map(id => ({ id, name: `Tenant ${id?.substring?.(0, 4) || '???'}` }))
            }
        };
    }, [gdbActive, gdbPreparation, gdbIntent, todayCandidates, todayCommits, members, capacityConfig, filterMode, projectId, joinedTenants, allProjects]);

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
            isEngaged: false
        };

        try {
            await getRepository().createItem(newItem);
            refreshAll(); // Refresh to show new item
            console.log('Import successful', item.title);
        } catch (e) {
            console.error('Import failed', e);
        }
    };

    // --- Computed Filtered Data & Ghost Counts ---
    const filterItems = useCallback((items: Item[]) => {
        if (filterMode === 'all') return items;
        if (filterMode === 'company') {
            // Company items: Explicitly linked to a tenant, or domain is 'business'
            return items.filter(i => !!i.tenantId || i.domain === 'business');
        }
        if (filterMode === 'personal') {
            // Personal items: No tenantId, and domain is not 'business' (usually 'private' or 'general')
            return items.filter(i => !i.tenantId && i.domain !== 'business');
        }
        return items;
    }, [filterMode]);

    const filteredGdbActive = filterItems(gdbActive);
    const filteredGdbPreparation = filterItems(gdbPreparation);
    const filteredGdbIntent = filterItems(gdbIntent);
    const filteredTodayCandidates = filterItems(todayCandidates);
    const filteredTodayCommits = filterItems(todayCommits);

    const ghostGdbCount = gdbActive.length + gdbPreparation.length + gdbIntent.length - (filteredGdbActive.length + filteredGdbPreparation.length + filteredGdbIntent.length);
    const ghostTodayCount = todayCandidates.length + todayCommits.length - (filteredTodayCandidates.length + filteredTodayCommits.length);

    // --- Capacity Used (Always Integrated/Unfiltered based on Matrix) ---
    const capacityUsed = (() => {
        const context = getQuantityContext();
        const today = new Date();
        const metrics = QuantityEngine.calculateMetrics([today], context);
        return metrics.get(today.toDateString())?.volumeMinutes || 0;
    })();
    const capacityLimit = capacityConfig.defaultDailyMinutes;
    const isOverCapacity = capacityUsed > capacityLimit;

    // [NEW] Sub-Task Actions
    const createSubTask = async (parentId: string, title: string, initialDueDate?: string, domain: 'business' | 'general' | 'private' = 'general'): Promise<string | undefined> => { // [FIX] Added initialDueDate & domain
        if (!title.trim()) return;

        // [NEW] Locate parent to inherit projectId correctly
        const allLocal = [...gdbActive, ...gdbPreparation, ...gdbIntent, ...todayCandidates, ...todayCommits, ...allProjects];
        const parentItem = allLocal.find(i => i.id === parentId);

        // Uses the same create logic but with parentId
        const newItem: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'statusUpdatedAt'> = {
            title,
            status: 'inbox',
            parentId,
            // [FIX] Inherit projectId: If parent is a project, use it. If parent has a project, use that.
            projectId: parentItem ? (parentItem.isProject ? parentItem.id : parentItem.projectId) : undefined,
            due_date: initialDueDate, // [NEW] Inherit due date
            // Defaults
            weight: 1,
            interrupt: false,
            category: 'subtask',
            type: 'generic',
            domain, // [NEW] Link domain
            focusOrder: 0,
            isEngaged: false
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

    // [NEW] Unified Projectization helper
    const projectizeItem = async (id: string) => {
        await updateItem(id, { isProject: true });
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
        const projectItem: any = {
            ...project,
            type: 'project',     // Explicitly set type as project
            isProject: true,     // Flag
            domain: domain || 'general',
            status: 'inbox',      // Default to inbox
            focusOrder: 0,
            isEngaged: false,
            // tenantId is already in ...project if passed from dialog
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


    // --- Return to UI (Aligned with Dashboard Requirements) ---
    return {
        // State
        gdbActive: filteredGdbActive,
        gdbPreparation: filteredGdbPreparation,
        gdbIntent: filteredGdbIntent,
        gdbLog,
        todayCandidates: filteredTodayCandidates,
        todayCommits: filteredTodayCommits,
        executionItem,
        memos,
        members,

        // Filter / Ghost Info
        filterMode,
        setFilterMode,
        ghostGdbCount,
        ghostTodayCount,

        // Capacity
        capacityUsed,
        capacityLimit,
        isOverCapacity,
        capacityConfig, // New state
        currentUserId, // [NEW] Context for ABAC

        // Meta
        error,
        isLoading: false, // Could add actual loading state tracking if needed

        // Actions
        refreshAll,
        refreshGdb,
        refreshToday,
        refreshMembers,
        resolveDecision,
        commitToToday,
        uncommitFromToday,
        completeItem,
        addSideMemo,
        deleteSideMemo,
        memoToInbox,
        deleteItem, // Now behaves as "Move to Trash" or "Trash"
        archiveItem, // [NEW]
        restoreItem, // [NEW]
        destroyItem, // [NEW]
        returnToInbox,
        prioritizeTask,
        startImmediately,
        updateItemTitle,
        updateItem,
        projectizeItem, // [NEW]
        createSubTask,
        getSubTasks,
        delegateTask,
        reportDelegationCompletion,
        confirmDelegationCompletion,
        createProject,
        importFromPlugin,
        allProjects,
        joinedTenants,
        toggleHoliday,
        updatePreparationDate,
        moveToSomeday,
        setEngaged,
        throwIn,
        updateCapacityConfig,
        clearError: () => setError(null),
        skipTask // [NEW]
    };
};
