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

        // [UUID v7] Simplified: Single ID format only
        const activeProjectId = activeProject?.cloudId || (activeProject?.id ? String(activeProject.id) : null);

        // [NEW] Helper to get all descendant project IDs (recursive)
        const getRelevantProjectIds = (rootId: string): Set<string> => {
            const ids = new Set<string>([rootId]);

            const stack = [rootId];
            while (stack.length > 0) {
                const currentId = stack.pop()!;
                allProjects.forEach(p => {
                    const pid = String(p.id);
                    if ((String(p.parentId) === currentId || String(p.projectId) === currentId) && !ids.has(pid)) {
                        ids.add(pid);
                        stack.push(pid);
                    }
                });
            }
            return ids;
        };

        const relevantProjectIds = activeProjectId ? getRelevantProjectIds(activeProjectId) : null;


        // 1. Gather all tasks from ALL zones
        const allItemsRaw = [
            ...gdbActive,
            ...gdbPreparation,
            ...gdbIntent,
            ...todayCandidates,
            ...todayCommits,
            ...(executionItem ? [executionItem] : []),
            ...(gdbLog || [])
        ];

        // Deduplicate items by ID
        const seenIds = new Set<string>();
        const allItems = allItemsRaw.filter(item => {
            if (seenIds.has(item.id)) return false;
            seenIds.add(item.id);
            if (item.isProject) return false;
            if (item.isArchived) return false;
            if (item.deletedAt) return false;

            // [FIX] Project Focused Filtering (including descendants + dual ID format support)
            if (relevantProjectIds) {
                const itemProjectId = item.projectId ? String(item.projectId) : null;
                return itemProjectId && relevantProjectIds.has(itemProjectId);
            }
            return true;
        });

        // Sorting Helper
        const sortItems = (items: Item[]) => {
            return [...items].sort((a, b) => {
                const aDue = a.due_date ? new Date(a.due_date).getTime() : Infinity;
                const aPrep = a.prep_date ? a.prep_date * 1000 : Infinity;
                const bDue = b.due_date ? new Date(b.due_date).getTime() : Infinity;
                const bPrep = b.prep_date ? b.prep_date * 1000 : Infinity;

                const aLimit = Math.min(aDue, aPrep);
                const bLimit = Math.min(bDue, bPrep);

                if (aLimit === Infinity && bLimit === Infinity) {
                    return (b.createdAt || 0) - (a.createdAt || 0);
                }
                if (aLimit === Infinity) return -1;
                if (bLimit === Infinity) return 1;
                if (aLimit !== bLimit) return aLimit - bLimit;
                return (a.createdAt || 0) - (b.createdAt || 0);
            });
        };

        const result: NewspaperItemWrapper[] = [];

        // 2. Identify all relevant projects for grouping
        const projectsToShow = relevantProjectIds
            ? allProjects.filter(p => relevantProjectIds.has(String(p.id)))
            : allProjects;

        const projectGroups = projectsToShow.map(proj => {
            const items = allItems.filter(item => {
                const ipid = item.projectId ? String(item.projectId) : null;
                if (!ipid) return false;
                // [FIX] Group items by checking both primary and alternate project ID formats
                return ipid === String(proj.id) || (proj.projectId && ipid === String(proj.projectId));
            });
            return {
                project: proj,
                items: items
            };
        }).filter(group => group.items.length > 0 || String(group.project.id) === activeProjectId);

        // 3. Process items without a project first
        const noProjectItems = allItems.filter(item => !item.projectId);
        sortItems(noProjectItems).forEach(item => {
            result.push({
                id: item.id,
                type: 'item',
                item,
                isHeader: false,
                depth: 0
            });
        });

        // 4. Sort project groups (Company -> Personal)
        const sortedProjectGroups = [...projectGroups].sort((a, b) => {
            const aIsCompany = !!a.project.tenantId;
            const bIsCompany = !!b.project.tenantId;
            if (aIsCompany && !bIsCompany) return -1;
            if (!aIsCompany && bIsCompany) return 1;
            return 0;
        });

        // 5. Build final list
        sortedProjectGroups.forEach(group => {
            const p = group.project;
            const tasks = group.items;

            // Add Header
            result.push({
                id: `header-${p.id}`,
                type: 'header',
                isHeader: true,
                item: { ...p, id: `virtual-header-${p.id}` },
                project: p,
                depth: 0
            });

            // Add Sorted Tasks
            sortItems(tasks).forEach(task => {
                result.push({
                    id: task.id,
                    type: 'item',
                    item: task,
                    project: p,
                    isHeader: false,
                    depth: 1
                });
            });
        });

        return result;

    }, [gdbActive, gdbPreparation, gdbIntent, gdbLog, todayCandidates, todayCommits, executionItem, allProjects, activeProject]);
};
