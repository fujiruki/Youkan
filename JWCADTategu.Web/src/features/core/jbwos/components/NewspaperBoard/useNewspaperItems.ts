import { useMemo } from 'react';
import { Item } from '../../types';
import { useJBWOSViewModel } from '../../viewmodels/useJBWOSViewModel';

export type JBWOSViewModel = ReturnType<typeof useJBWOSViewModel>;

export interface NewspaperItemWrapper {
    id: string;
    type: 'item' | 'header';
    item: Item;
    project?: Item | null; // Projects are Items in ViewModel
    isHeader: boolean;
    depth: number;
}

export const useNewspaperItems = (viewModel: JBWOSViewModel, activeProject?: any | null): NewspaperItemWrapper[] => {
    const {
        gdbActive,
        gdbPreparation,
        gdbIntent,
        gdbLog,
        allProjects,
        todayCandidates,
        todayCommits,
        executionItem
    } = viewModel;

    return useMemo(() => {
        // [DEBUG]
        console.log('[useNewspaperItems] Processing start', {
            todayCommits: todayCommits.map(i => i.title),
            allProjects: allProjects.map(p => ({ id: p.id, title: p.title }))
        });

        const activeProjectId = activeProject?.cloudId || (activeProject?.id ? String(activeProject.id) : null);

        // 1. Gather all tasks from ALL zones
        const allItems = [
            ...gdbActive,
            ...gdbPreparation,
            ...gdbIntent,
            ...todayCandidates,
            ...todayCommits,
            ...(executionItem ? [executionItem] : []),
            ...(gdbLog || [])
        ].filter(item => {
            if (item.isProject) return false;
            if (item.isArchived) return false;
            if (item.deletedAt) return false;

            // [NEW] Project Focused Filtering
            if (activeProjectId) {
                return String(item.projectId) === activeProjectId;
            }

            return true;
        });

        // Sorting Helper
        const sortItems = (items: Item[]) => {
            return [...items].sort((a, b) => {
                // [FIX] Consider both due_date and prep_date (My Deadline)
                const aDue = a.due_date ? new Date(a.due_date).getTime() : Infinity;
                const aPrep = a.prep_date ? a.prep_date * 1000 : Infinity;
                const bDue = b.due_date ? new Date(b.due_date).getTime() : Infinity;
                const bPrep = b.prep_date ? b.prep_date * 1000 : Infinity;

                const aLimit = Math.min(aDue, aPrep);
                const bLimit = Math.min(bDue, bPrep);

                // 1. Both no dates (Infinity): Sort by CreatedAt (Newest first)
                if (aLimit === Infinity && bLimit === Infinity) {
                    return (b.createdAt || 0) - (a.createdAt || 0);
                }

                // 2. Either no dates: No date (Infinity) items go first (User Requirement)
                if (aLimit === Infinity) return -1;
                if (bLimit === Infinity) return 1;

                // 3. Both have dates: Sort by earlier date (Soonest first)
                if (aLimit !== bLimit) {
                    return aLimit - bLimit;
                }

                // 4. Tie-breaker for same dates: Oldest first (FIFO)
                return (a.createdAt || 0) - (b.createdAt || 0);
            });
        };

        // 2. Group by ProjectId
        const noProjectItemsRaw: Item[] = [];
        const projectItemMap = new Map<string, Item[]>();
        const seenIds = new Set<string>();

        allItems.forEach(item => {
            if (seenIds.has(item.id)) return;
            seenIds.add(item.id);

            if (!item.projectId) {
                noProjectItemsRaw.push(item);
            } else {
                const pid = String(item.projectId);
                if (!projectItemMap.has(pid)) {
                    projectItemMap.set(pid, []);
                }
                projectItemMap.get(pid)?.push(item);
            }
        });

        const result: NewspaperItemWrapper[] = [];

        // 3. Sort Projects (Company -> Personal)
        const companyProjects = allProjects.filter(p => !!p.tenantId);
        const personalProjects = allProjects.filter(p => !p.tenantId);

        // 3.1 No Project Items (Sorted)
        sortItems(noProjectItemsRaw).forEach(item => {
            result.push({
                id: item.id,
                type: 'item',
                item,
                isHeader: false,
                depth: 0
            });
        });

        const processProjects = (projects: Item[]) => {
            projects.forEach(p => {
                const tasks = projectItemMap.get(String(p.id)) || [];
                // [MOD] Removed tasks.length > 0 check to show empty projects

                // Add Header
                result.push({
                    id: `header-${p.id}`,
                    type: 'header',
                    isHeader: true,
                    item: {
                        ...p,
                        id: `virtual-header-${p.id}`,
                    },
                    project: p,
                    depth: 0
                });

                // Add Sorted Tasks with Indent
                sortItems(tasks).forEach(task => {
                    result.push({
                        id: task.id,
                        type: 'item',
                        item: task,
                        project: p,
                        isHeader: false,
                        depth: 1 // Indent Level 1
                    });
                });
            });
        };

        // 3.2 Company Projects
        processProjects(companyProjects);

        // 3.3 Personal Projects
        processProjects(personalProjects);

        return result;

    }, [gdbActive, gdbPreparation, gdbIntent, gdbLog, todayCandidates, todayCommits, executionItem, allProjects, activeProject]);
};
