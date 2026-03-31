import { Item } from '../types';
import { compareGeneralList2Items, getProjectUrgencyScore } from './sorting';

export interface HierarchyOptions {
	activeProjectId?: string | null;
	allProjects: Item[];
	showGroups?: boolean;
	allItems: Item[];
	hideCompleted?: boolean;
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

export const buildHierarchicalList = (options: HierarchyOptions): HierarchicalWrapper[] => {
	const { allItems, allProjects, showGroups = true, activeProjectId, hideCompleted = false } = options;

	// 1. Prepare Data
	// We treat everything that is a project (isProject=true or in allProjects) as a potential container.
	const projectMap = new Map<string, Item>();
	allProjects.forEach(p => {
		if (!p || !p.id) return;
		const nid = normalizeId(String(p.id))!;
		projectMap.set(nid, p);
	});
	allItems.forEach(item => {
		if (item && item.id && (item.isProject || item.type === 'project')) {
			const nid = normalizeId(item.id)!;
			if (!projectMap.has(nid)) {
				projectMap.set(nid, item);
			}
		}
	});

	const seenItemIds = new Set<string>();
	const allFilteredItems = allItems.filter(item => {
		if (!item || !item.id) return false;
		const nid = normalizeId(item.id)!;
		if (seenItemIds.has(nid)) return false;
		seenItemIds.add(nid);
		if (item.isArchived) return false;
		if (hideCompleted && item.status === 'done') return false;
		// If it's a project container, we don't treat it as a "task" item in the main list
		if (item.isProject || item.type === 'project') return false;
		return true;
	});

	const result: HierarchicalWrapper[] = [];
	const processedIds = new Set<string>();

	const addRecursiveHierarchy = (containerId: string | null, rawDepth: number, projectContext: Item | null) => {
		// showGroups=false（一覧モード）では全アイテムをフラット表示
		const depth = showGroups ? rawDepth : 0;
		const nContainerId = normalizeId(containerId);

		// A. Add Sub-Tasks (Direct children of this container)
		const subTasks = allFilteredItems.filter(item => {
			const ipid = normalizeId(item.projectId ? String(item.projectId) : null);
			const iparentId = normalizeId(item.parentId ? String(item.parentId) : null);

			if (nContainerId === null) {
				// Root tasks: 
				// 1. No parentId AND (No projectId OR projectId not in our identified projects)
				// 2. OR parentId is not in our identified items/projects (Orphan)
				const parentExists = iparentId && (processedIds.has(iparentId) || projectMap.has(iparentId));
				const projectExists = ipid && projectMap.has(ipid);
				return !parentExists && !projectExists;
			}

			// Child tasks: parentId matches this container OR (no parentId AND projectId matches this container)
			return areIdsMatching(iparentId, nContainerId) || (!iparentId && areIdsMatching(ipid, nContainerId));
		});

		[...subTasks].sort(compareGeneralList2Items).forEach(task => {
			const tid = normalizeId(task.id)!;
			if (processedIds.has(tid)) return;
			processedIds.add(tid);

			result.push({
				id: task.id,
				type: 'item',
				item: task,
				project: projectContext,
				depth
			});
			// Task can have children too!
			addRecursiveHierarchy(task.id, depth + 1, projectContext);
		});

		// B. Add Sub-Projects (Projects whose parent is this container)
		const subProjects = Array.from(projectMap.values()).filter(p => {
			const ipid = normalizeId(p.projectId ? String(p.projectId) : null);
			const iparentId = normalizeId(p.parentId ? String(p.parentId) : null);

			if (nContainerId === null) {
				// Root projects:
				// 1. parentId is null AND (projectId is null OR projectId is itself)
				// 2. OR parentId/projectId not in identified projects (Orphan)
				const parentExists = iparentId && projectMap.has(iparentId);
				const projectExists = ipid && projectMap.has(ipid) && !areIdsMatching(ipid, p.id);
				return !parentExists && !projectExists;
			}

			return areIdsMatching(iparentId, nContainerId) || (!iparentId && areIdsMatching(ipid, nContainerId) && !areIdsMatching(ipid, p.id));
		});

		[...subProjects].sort((a, b) => {
			const tasksA = allFilteredItems.filter(i => areIdsMatching(i.projectId, a.id) || areIdsMatching(i.parentId, a.id));
			const tasksB = allFilteredItems.filter(i => areIdsMatching(i.projectId, b.id) || areIdsMatching(i.parentId, b.id));
			return getProjectUrgencyScore(tasksB) - getProjectUrgencyScore(tasksA);
		}).forEach(proj => {
			const pid = normalizeId(String(proj.id))!;
			if (processedIds.has(pid)) return;
			processedIds.add(pid);

			if (showGroups) {
				result.push({
					id: `header-${proj.id}`,
					type: 'header',
					item: { ...proj, id: `virtual-header-${proj.id}` },
					project: proj,
					depth
				});
			}

			// Recurse into this project
			addRecursiveHierarchy(proj.id + '', depth + (showGroups ? 1 : 0), proj);
		});
	};

	// Entry Point: Start from specific project if focus is active, otherwise root
	const normalizedActiveId = normalizeId(activeProjectId);
	if (normalizedActiveId && projectMap.has(normalizedActiveId)) {
		const activeProj = projectMap.get(normalizedActiveId)!;
		// Add the focused project header itself first if showGroups is on
		if (showGroups) {
			result.push({
				id: `header-${activeProj.id}`,
				type: 'header',
				item: { ...activeProj, id: `virtual-header-${activeProj.id}` },
				project: activeProj,
				depth: 0
			});
		}
		// Start recursion from this project
		addRecursiveHierarchy(activeProj.id + '', (showGroups ? 1 : 0), activeProj);
	} else {
		addRecursiveHierarchy(null, 0, null);
	}

	return result;
};

/**
 * BucketColumn用: アイテム配列を親子関係でフラット化する。
 * 循環参照を検出してスキップする。
 */
export const sortItemsHierarchically = (allItems: Item[]): { item: Item; depth: number }[] => {
	const itemMap = new Map<string, Item>();
	const childrenMap = new Map<string, Item[]>();
	const roots: Item[] = [];

	allItems.forEach(item => {
		itemMap.set(item.id, item);
		if (item.parentId && allItems.find(p => p.id === item.parentId)) {
			if (!childrenMap.has(item.parentId)) childrenMap.set(item.parentId, []);
			childrenMap.get(item.parentId)!.push(item);
		} else {
			roots.push(item);
		}
	});

	const result: { item: Item; depth: number }[] = [];
	const visited = new Set<string>();

	const processItem = (item: Item, depth: number) => {
		if (visited.has(item.id)) return;
		visited.add(item.id);
		result.push({ item, depth });
		const children = childrenMap.get(item.id) || [];
		children.forEach(child => processItem(child, depth + 1));
	};

	roots.forEach(root => processItem(root, 0));

	// 循環参照でrootsに入らなかったアイテムをdepth 0で追加
	allItems.forEach(item => {
		if (!visited.has(item.id)) {
			visited.add(item.id);
			result.push({ item, depth: 0 });
		}
	});

	return result;
};

/**
 * ProjectRegistryScreen用: プロジェクト配列を親子関係でフラット化する。
 * 循環参照を検出してスキップする。
 */
export const getHierarchicalProjects = <T extends { id?: number; parentId?: string }>(
	projs: T[]
): (T & { depth: number })[] => {
	const result: (T & { depth: number })[] = [];
	const visited = new Set<string>();

	const rootProjects = projs.filter(p =>
		!p.parentId || !projs.some(pp => String(pp.id) === String(p.parentId))
	);

	const addRecursive = (parentId: string, depth: number) => {
		const children = projs.filter(p => String(p.parentId) === String(parentId));
		children.forEach(child => {
			const childId = String(child.id);
			if (visited.has(childId)) return;
			visited.add(childId);
			result.push({ ...child, depth: depth + 1 });
			addRecursive(childId, depth + 1);
		});
	};

	rootProjects.forEach(root => {
		const rootId = String(root.id);
		if (visited.has(rootId)) return;
		visited.add(rootId);
		result.push({ ...root, depth: 0 });
		addRecursive(rootId, 0);
	});

	// 循環参照でrootsにもchildrenにも入らなかったプロジェクトをdepth 0で追加
	projs.forEach(p => {
		const pid = String(p.id);
		if (!visited.has(pid)) {
			visited.add(pid);
			result.push({ ...p, depth: 0 });
		}
	});

	return result;
};
