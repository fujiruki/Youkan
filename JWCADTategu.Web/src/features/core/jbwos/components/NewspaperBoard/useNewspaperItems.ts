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

export const useNewspaperItems = (viewModel: JBWOSViewModel): NewspaperItemWrapper[] => {
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
            return true;
        });

        // Sorting Helper
        const sortItems = (items: Item[]) => {
            return [...items].sort((a, b) => {
                const aDue = a.due_date ? new Date(a.due_date).getTime() : (a.prep_date ? a.prep_date * 1000 : null);
                const bDue = b.due_date ? new Date(b.due_date).getTime() : (b.prep_date ? b.prep_date * 1000 : null);

                // 1. Items without due date go first
                if (aDue === null && bDue !== null) return -1;
                if (aDue !== null && bDue === null) return 1;

                // 2. Both have no due date: Sort by CreatedAt (Newest first)
                if (aDue === null && bDue === null) {
                    return (b.createdAt || 0) - (a.createdAt || 0);
                }

                // 3. Both have due date: Sort by DueDate (Soonest first)
                if (aDue !== bDue) {
                    return (aDue || 0) - (bDue || 0);
                }

                // 4. Tie-breaker: Oldest first (FIFO)
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
                if (tasks.length > 0) {
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
                }
            });
        };

        // 3.2 Company Projects
        processProjects(companyProjects);

        // 3.3 Personal Projects
        processProjects(personalProjects);

        return result;

    }, [gdbActive, gdbPreparation, gdbIntent, gdbLog, todayCandidates, todayCommits, executionItem, allProjects]);
};
