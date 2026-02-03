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

        // 2. Group by ProjectId
        const noProjectItems: Item[] = [];
        const projectItemMap = new Map<string, Item[]>();
        const seenIds = new Set<string>();

        allItems.forEach(item => {
            if (seenIds.has(item.id)) return;
            seenIds.add(item.id);

            if (!item.projectId) {
                noProjectItems.push(item);
            } else {
                const pid = String(item.projectId); // [FIX] Ensure string key
                if (!projectItemMap.has(pid)) {
                    projectItemMap.set(pid, []);
                }
                projectItemMap.get(pid)?.push(item);
            }
        });

        const result: NewspaperItemWrapper[] = [];

        // 3. Sort Projects (Company -> Personal)
        const companyProjects: Item[] = [];
        const personalProjects: Item[] = [];

        allProjects.forEach((p: Item) => {
            if (p.tenantId) {
                companyProjects.push(p);
            } else {
                personalProjects.push(p);
            }
        });

        // [DEBUG]
        console.log('[useNewspaperItems] Grouped stats', {
            noProjectCount: noProjectItems.length,
            projectItemMapKeys: Array.from(projectItemMap.keys())
        });

        // 3.1 No Project Items
        noProjectItems.forEach(item => {
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
                const tasks = projectItemMap.get(String(p.id)) || []; // [FIX] Ensure string key
                if (tasks.length > 0) {
                    // Add Header
                    result.push({
                        id: `header-${p.id}`,
                        type: 'header',
                        isHeader: true,
                        item: {
                            id: `virtual-header-${p.id}`,
                            title: p.title,
                            status: 'inbox',
                            isProject: true,
                            projectId: p.id,
                            createdAt: 0,
                            updatedAt: 0,
                            statusUpdatedAt: 0,
                            focusOrder: 0,
                            isEngaged: false,
                            interrupt: false,
                            weight: 1
                        },
                        project: p,
                        depth: 0
                    });

                    tasks.forEach(task => {
                        result.push({
                            id: task.id,
                            type: 'item',
                            item: task,
                            project: p,
                            isHeader: false,
                            depth: 1
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
