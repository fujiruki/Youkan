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
        allProjects: viewModelProjects,
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

            let iterations = 0;
            const MAX_ITERATIONS = 1000;

            while (stack.length > 0 && iterations < MAX_ITERATIONS) {
                iterations++;
                const currentId = stack.pop()!;
                viewModelProjects.forEach(p => {
                    const pid = String(p.id);
                    // [FIX] Projects are descendants if they have a parentId link OR a projectId link
                    const isParentMatch = p.parentId && String(p.parentId) === currentId;
                    const isProjectMatch = p.projectId && String(p.projectId) === currentId;

                    if ((isParentMatch || isProjectMatch) && !ids.has(pid)) {
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
        const allFilteredItems = allItemsRaw.filter(item => {
            if (seenIds.has(item.id)) return false;
            seenIds.add(item.id);
            if (item.isProject) return false;
            if (item.isArchived) return false;
            if (item.deletedAt) return false;

            // [FIX] Project Focused Filtering (including descendants + dual ID format support)
            if (relevantProjectIds) {
                const itemProjectId = item.projectId ? String(item.projectId) : null;
                const itemParentId = item.parentId ? String(item.parentId) : null;
                return (itemProjectId && relevantProjectIds.has(itemProjectId)) ||
                    (itemParentId && relevantProjectIds.has(itemParentId));
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
        const projectsInView = relevantProjectIds
            ? viewModelProjects.filter(p => relevantProjectIds.has(String(p.id)))
            : viewModelProjects;

        const projectGroups = projectsInView.map(proj => {
            const items = allFilteredItems.filter(item => {
                const ipid = item.projectId ? String(item.projectId) : null;
                const iparentId = item.parentId ? String(item.parentId) : null;

                // [FIX] Priority Allocation:
                // 1. If parentId matches this project, it belongs here.
                if (iparentId === String(proj.id)) return true;

                // 2. If no parentId matches ANY other project in projectsInView, and projectId matches this project, it belongs here.
                if (ipid === String(proj.id)) {
                    const hasOtherParentInView = iparentId && projectsInView.some(p => String(p.id) === iparentId);
                    return !hasOtherParentInView;
                }

                return false;
            });
            return {
                project: proj,
                items: items
            };
        }); // [FIX] Show all projects including empty ones (filter removed)

        // 3. Process items without a valid project ID/Parent ID match (Root Inbox items)
        const noProjectItems = allFilteredItems.filter(item => {
            const ipid = item.projectId ? String(item.projectId) : null;
            const iparentId = item.parentId ? String(item.parentId) : null;
            const hasProjectInView = projectsInView.some(p => String(p.id) === ipid || String(p.id) === iparentId);
            return !hasProjectInView;
        });

        sortItems(noProjectItems).forEach(item => {
            result.push({
                id: item.id,
                type: 'item',
                item,
                isHeader: false,
                depth: 0
            });
        });

        // 4. Sort project groups (Company -> Personal, then by parent-child relationship)
        const sortedProjectGroups = [...projectGroups].sort((a, b) => {
            // First: Company -> Personal
            const aIsCompany = !!a.project.tenantId;
            const bIsCompany = !!b.project.tenantId;
            if (aIsCompany && !bIsCompany) return -1;
            if (!aIsCompany && bIsCompany) return 1;
            return 0;
        });

        // [NEW] Recursive function to add projects with their children
        const addProjectWithChildren = (proj: Item, depth: number, processedProjectIds: Set<string>) => {
            if (processedProjectIds.has(proj.id)) return;
            processedProjectIds.add(proj.id);

            const group = projectGroups.find(g => String(g.project.id) === String(proj.id));
            if (!group) return;

            // Add Header
            result.push({
                id: `header-${proj.id}`,
                type: 'header',
                isHeader: true,
                item: { ...proj, id: `virtual-header-${proj.id}` },
                project: proj,
                depth: depth
            });

            // Add Sorted Tasks for this project
            sortItems(group.items).forEach(task => {
                result.push({
                    id: task.id,
                    type: 'item',
                    item: task,
                    project: proj,
                    isHeader: false,
                    depth: depth + 1
                });
            });

            // [NEW] Find and add child projects (recursively)
            const childProjects = viewModelProjects.filter(p => {
                if (!p.isProject || String(p.id) === String(proj.id)) return false;
                const isParentMatch = p.parentId && String(p.parentId) === String(proj.id);
                const isProjectMatch = p.projectId && String(p.projectId) === String(proj.id);
                return isParentMatch || isProjectMatch;
            });

            // Sort child projects
            const sortedChildren = [...childProjects].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

            sortedChildren.forEach(child => {
                addProjectWithChildren(child, depth + 1, processedProjectIds);
            });
        };

        // 5. Build final list - start with root projects only
        const rootProjects = sortedProjectGroups
            .map(g => g.project)
            .filter(p => {
                const pId = p.parentId ? String(p.parentId) : null;
                const prId = p.projectId ? String(p.projectId) : null;
                if (!pId && !prId) return true;

                const parentInView = projectsInView.some(pp =>
                    (pId && String(pp.id) === pId) || (prId && String(pp.id) === prId)
                );
                return !parentInView;
            });

        const processedProjectIds = new Set<string>();
        rootProjects.forEach(proj => {
            addProjectWithChildren(proj, 0, processedProjectIds);
        });

        return result;

    }, [gdbActive, gdbPreparation, gdbIntent, gdbLog, todayCandidates, todayCommits, executionItem, viewModelProjects, activeProject]);
};
