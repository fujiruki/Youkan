import { Item } from '../types';
import { collectDescendantIds, normalizeId, resolveRootProjectId } from './hierarchy';

export type DragMoveDisallowReason = 'self' | 'descendant' | 'tenant-mismatch' | 'archived';

export type DragMoveOutcome =
	| { allowed: true; updates: { projectId: string; parentId: null } | { parentId: string; projectId: string } }
	| { allowed: false; reason: DragMoveDisallowReason };

/**
 * R-155: 全体一覧ドラッグでプロジェクト移動。
 * タスクをheaderへドロップした際の可否判定と、確定時の更新payload算出を1箇所に共通化する。
 * hoverのdisabled判定（ハイライト抑止）とドロップ確定時の両方でこの関数を使う（別解釈を作らない）。
 * docs/SPEC/09_全体一覧ドラッグでプロジェクト移動.md §5・§6 を正とする。
 */
export const computeDragMoveOutcome = (
	draggedItem: Item,
	targetProject: Item,
	allItemsForDescendants: Item[],
	allProjectsForResolve: Item[]
): DragMoveOutcome => {
	const draggedId = normalizeId(draggedItem.id);
	const targetId = normalizeId(String(targetProject.id));

	if (draggedId && targetId && draggedId === targetId) {
		return { allowed: false, reason: 'self' };
	}

	const descendantIds = collectDescendantIds(allItemsForDescendants, draggedItem.id)
		.map(id => normalizeId(id));
	if (targetId && descendantIds.includes(targetId)) {
		return { allowed: false, reason: 'descendant' };
	}

	if (targetProject.isArchived) {
		return { allowed: false, reason: 'archived' };
	}

	const draggedTenant = draggedItem.tenantId ?? null;
	const targetTenant = targetProject.tenantId ?? null;
	if (draggedTenant !== targetTenant) {
		return { allowed: false, reason: 'tenant-mismatch' };
	}

	const targetProjectId = String(targetProject.id);
	const rootId = resolveRootProjectId(targetProjectId, allProjectsForResolve);
	const isRootDrop = normalizeId(rootId) === normalizeId(targetProjectId);

	return {
		allowed: true,
		updates: isRootDrop
			? { projectId: targetProjectId, parentId: null }
			: { parentId: targetProjectId, projectId: rootId },
	};
};
