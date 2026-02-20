import { Item } from '../types';
import { compareGeneralList2Items, getProjectUrgencyScore } from './sorting';

export interface HierarchyOptions {
    activeProjectId?: string | null;
    allProjects: Item[];
    showGroups?: boolean;
    allItems: Item[];
}

export interface HierarchicalWrapper {
    id: string;
    type: 'item' | 'header';
    item: Item;
    project?: Item | null;
    depth: number;
}

/**
 * Normalizes IDs for robust comparison.
 */
export const normalizeId = (id: string | null | undefined): string | null => {
    if (id === null || id === undefined) return null;
    const s = String(id).trim().toLowerCase();
    if (!s || s === 'null' || s === 'undefined') return null;
    return s.replace(/^prj-/, '');
};

const areIdsMatching = (id1: any, id2: any): boolean => {
    const n1 = normalizeId(String(id1));
    const n2 = normalizeId(String(id2));
    if (!n1 || !n2) return false;
    return n1 === n2;
};

/**
 * Builds a flattened list of items and project headers representing the hierarchy.
 */
export const buildHierarchicalList = (options: HierarchyOptions): HierarchicalWrapper[] => {
    const { allItems, allProjects, showGroups = true } = options;

    // 1. Prepare Data
    const seenItemIds = new Set<string>();
    const allFilteredItems = allItems.filter(item => {
        if (!item || !item.id) return false;
        const nid = normalizeId(item.id)!;
        if (seenItemIds.has(nid)) return false;
        seenItemIds.add(nid);
        if (item.isArchived) return false;
        if (item.isProject || item.type === 'project') return false;
        return true;
    });

    const projectsInView = allProjects.filter(p => !!p && !!p.id);
    const result: HierarchicalWrapper[] = [];
    const processedIds = new Set<string>();

    const addProjectHierarchy = (proj: Item, depth: number) => {
        const pId = normalizeId(String(proj.id));
        const pcId = (proj as any).cloudId ? normalizeId((proj as any).cloudId) : null;
        const primaryId = pcId || pId;
        if (!primaryId || processedIds.has(primaryId)) return;

        processedIds.add(primaryId);
        if (pId) processedIds.add(pId);
        if (pcId) processedIds.add(pcId);

        if (showGroups) {
            result.push({
                id: `header-${proj.id}`,
                type: 'header',
                item: { ...proj, id: `virtual-header-${proj.id}` },
                project: proj,
                depth
            });
        }

        // --- Improved Task Discovery ---
        // Find ALL items that belong to this project ID
        const taskCollection = allFilteredItems.filter(item => {
            const ipid = normalizeId(item.projectId ? String(item.projectId) : null);
            const iparentId = normalizeId(item.parentId ? String(item.parentId) : null);
            return ipid === pId || ipid === pcId || iparentId === pId || iparentId === pcId;
        });

        if (taskCollection.length > 0) {
            const addTaskSubTree = (parentId: string | null, currentDepth: number) => {
                const nParentId = normalizeId(parentId);
                const children = taskCollection.filter(item => {
                    const tiparentId = normalizeId(item.parentId ? String(item.parentId) : null);
                    if (nParentId === null) {
                        // Roots of project: parent matches project OR parent not in THIS project's collection
                        return areIdsMatching(tiparentId, pId) || areIdsMatching(tiparentId, pcId) || !tiparentId ||
                            !taskCollection.some(other => areIdsMatching(other.id, tiparentId));
                    }
                    return areIdsMatching(tiparentId, nParentId);
                });

                [...children].sort(compareGeneralList2Items).forEach(child => {
                    const cid = normalizeId(child.id)!;
                    if (processedIds.has(cid)) return;
                    processedIds.add(cid);

                    result.push({
                        id: child.id,
                        type: 'item',
                        item: child,
                        project: proj,
                        depth: showGroups ? currentDepth + 1 : 0
                    });
                    addTaskSubTree(child.id, currentDepth + 1);
                });
            };
            addTaskSubTree(null, depth);
        }

        // --- Sub-Projects ---
        const subProjects = projectsInView.filter(p => {
            if (p === proj) return false;
            const pid = normalizeId(itemLabel(p).parentId);
            const ppid = normalizeId(itemLabel(p).projectId);
            return areIdsMatching(pid, pId) || areIdsMatching(pid, pcId) ||
                areIdsMatching(ppid, pId) || areIdsMatching(ppid, pcId);
        });

        [...subProjects].sort((a, b) => {
            const tasksA = allFilteredItems.filter(i => areIdsMatching(i.projectId, a.id) || areIdsMatching(i.parentId, a.id));
            const tasksB = allFilteredItems.filter(i => areIdsMatching(i.projectId, b.id) || areIdsMatching(i.parentId, b.id));
            return getProjectUrgencyScore(tasksB) - getProjectUrgencyScore(tasksA);
        }).forEach(child => addProjectHierarchy(child, depth + (showGroups ? 1 : 0)));
    };

    const itemLabel = (i: any) => ({ parentId: i.parentId ? String(i.parentId) : null, projectId: i.projectId ? String(i.projectId) : null });

    const rootProjects = projectsInView.filter(p => {
        const labels = itemLabel(p);
        return !projectsInView.some(otherP => {
            if (otherP === p) return false;
            const opId = normalizeId(String(otherP.id));
            const opcId = otherP.cloudId ? normalizeId(otherP.cloudId) : null;
            const ppid = normalizeId(labels.parentId);
            const pprojid = normalizeId(labels.projectId);
            return areIdsMatching(ppid, opId) || areIdsMatching(ppid, opcId) ||
                areIdsMatching(pprojid, opId) || areIdsMatching(pprojid, opcId);
        });
    }).sort((a, b) => {
        if (!!a.tenantId !== !!b.tenantId) return a.tenantId ? -1 : 1;
        const tasksA = allFilteredItems.filter(i => areIdsMatching(i.projectId, a.id) || areIdsMatching(i.parentId, a.id));
        const tasksB = allFilteredItems.filter(i => areIdsMatching(i.projectId, b.id) || areIdsMatching(i.parentId, b.id));
        return getProjectUrgencyScore(tasksB) - getProjectUrgencyScore(tasksA);
    });

    rootProjects.forEach(p => addProjectHierarchy(p, 0));

    // 4. Remaining Items
    const inboxItems = allFilteredItems.filter(item => !processedIds.has(normalizeId(item.id)!));
    [...inboxItems].sort(compareGeneralList2Items).forEach(item => {
        result.push({ id: item.id, type: 'item', item, depth: 0 });
    });

    return result;
};
