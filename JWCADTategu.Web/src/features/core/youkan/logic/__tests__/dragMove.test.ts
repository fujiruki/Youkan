import { describe, it, expect } from 'vitest';
import { computeDragMoveOutcome } from '../dragMove';
import { Item } from '../../types';

/**
 * R-155: 全体一覧ドラッグでプロジェクト移動。
 * ドロップ判定（安全性チェック）と更新payload算出（所属変更の値の決め方）を
 * hover中のdisabled判定・ドロップ確定時の両方で共有する単一ロジック。
 * docs/SPEC/09_全体一覧ドラッグでプロジェクト移動.md §5・§6・§12 を正とする。
 */

const makeTask = (id: string, overrides: Partial<Item> = {}): Item => ({
	id,
	title: `Task ${id}`,
	status: 'inbox',
	focusOrder: 0,
	isEngaged: false,
	statusUpdatedAt: 0,
	interrupt: false,
	weight: 2,
	parentId: null,
	projectId: null,
	createdAt: 0,
	updatedAt: 0,
	memo: '',
	due_date: '',
	flags: {},
	tenantId: 'tenant-1',
	estimatedMinutes: 60,
	assignedTo: 'member-1',
	...overrides,
} as Item);

const makeProject = (id: string, overrides: Partial<Item> = {}): Item => ({
	id,
	title: `Project ${id}`,
	status: 'inbox',
	focusOrder: 0,
	isEngaged: false,
	statusUpdatedAt: 0,
	interrupt: false,
	weight: 2,
	parentId: null,
	projectId: null,
	createdAt: 0,
	updatedAt: 0,
	memo: '',
	due_date: '',
	flags: {},
	isArchived: false,
	isProject: true,
	tenantId: 'tenant-1',
	...overrides,
} as Item);

describe('computeDragMoveOutcome（R-155）', () => {
	it('別ルートプロジェクトへの移動: projectId=移動先, parentId=nullを返す', () => {
		const task = makeTask('task-1', { projectId: 'proj-A', tenantId: 'tenant-1' });
		const targetRoot = makeProject('proj-B', { tenantId: 'tenant-1' });
		const outcome = computeDragMoveOutcome(task, targetRoot, [task, targetRoot], [targetRoot]);
		expect(outcome).toEqual({ allowed: true, updates: { projectId: 'proj-B', parentId: null } });
	});

	it('サブプロジェクトへの移動: parentId=移動先, projectId=ルート案件IDを返す', () => {
		const root = makeProject('root-1', { tenantId: 'tenant-1' });
		const sub = makeProject('sub-1', { parentId: 'root-1', tenantId: 'tenant-1' });
		const task = makeTask('task-1', { projectId: 'root-1', tenantId: 'tenant-1' });
		const outcome = computeDragMoveOutcome(task, sub, [task, root, sub], [root, sub]);
		expect(outcome).toEqual({ allowed: true, updates: { parentId: 'sub-1', projectId: 'root-1' } });
	});

	it('Beaver work_packageへの移動: parentId=work_package, projectId=案件ルートID（探索不要ケース）', () => {
		const beaverRoot = makeProject('beaver-root', { tenantId: 'tenant-1' });
		const workPackage = makeProject('wp-1', { parentId: null, projectId: 'beaver-root', tenantId: 'tenant-1' });
		const task = makeTask('task-1', { projectId: null, tenantId: 'tenant-1' });
		const outcome = computeDragMoveOutcome(task, workPackage, [task, beaverRoot, workPackage], [beaverRoot, workPackage]);
		expect(outcome).toEqual({ allowed: true, updates: { parentId: 'wp-1', projectId: 'beaver-root' } });
	});

	it('多階層のサブプロジェクトで、正しい階層のノードだけがターゲットになる（親子混同なし）', () => {
		const root = makeProject('root-1', { tenantId: 'tenant-1' });
		const mid = makeProject('mid-1', { parentId: 'root-1', tenantId: 'tenant-1' });
		const leaf = makeProject('leaf-1', { parentId: 'mid-1', tenantId: 'tenant-1' });
		const task = makeTask('task-1', { tenantId: 'tenant-1' });
		const allProjects = [root, mid, leaf];

		const toMid = computeDragMoveOutcome(task, mid, [task, ...allProjects], allProjects);
		expect(toMid).toEqual({ allowed: true, updates: { parentId: 'mid-1', projectId: 'root-1' } });

		const toLeaf = computeDragMoveOutcome(task, leaf, [task, ...allProjects], allProjects);
		expect(toLeaf).toEqual({ allowed: true, updates: { parentId: 'leaf-1', projectId: 'root-1' } });

		const toRoot = computeDragMoveOutcome(task, root, [task, ...allProjects], allProjects);
		expect(toRoot).toEqual({ allowed: true, updates: { projectId: 'root-1', parentId: null } });
	});

	it('他フィールド（工数・日付・担当・status等）は更新payloadに一切含まれない', () => {
		const task = makeTask('task-1', {
			tenantId: 'tenant-1',
			estimatedMinutes: 999,
			assignedTo: 'someone',
			status: 'focus',
			due_date: '2026-09-01',
			prep_date: 123,
		});
		const target = makeProject('proj-X', { tenantId: 'tenant-1' });
		const outcome = computeDragMoveOutcome(task, target, [task, target], [target]);
		expect(Object.keys(outcome.updates!).sort()).toEqual(['parentId', 'projectId']);
	});

	it('自分自身へのドロップは禁止される', () => {
		// isProject化されたタスクが自分自身のheaderとしても存在しうるケースへの防御
		const selfProjectized = makeProject('self-1', { tenantId: 'tenant-1' });
		const outcome = computeDragMoveOutcome(selfProjectized, selfProjectized, [selfProjectized], [selfProjectized]);
		expect(outcome).toEqual({ allowed: false, reason: 'self' });
	});

	it('自分の子孫へのドロップは循環防止のため禁止される', () => {
		const parentTask = makeTask('parent-task', { tenantId: 'tenant-1' });
		const childProject = makeProject('child-proj', { parentId: 'parent-task', tenantId: 'tenant-1' });
		const outcome = computeDragMoveOutcome(
			parentTask,
			childProject,
			[parentTask, childProject],
			[childProject]
		);
		expect(outcome).toEqual({ allowed: false, reason: 'descendant' });
	});

	it('孫（子孫の子孫）へのドロップも禁止される', () => {
		const parentTask = makeTask('parent-task', { tenantId: 'tenant-1' });
		const childProject = makeProject('child-proj', { parentId: 'parent-task', tenantId: 'tenant-1' });
		const grandchildProject = makeProject('grandchild-proj', { parentId: 'child-proj', tenantId: 'tenant-1' });
		const outcome = computeDragMoveOutcome(
			parentTask,
			grandchildProject,
			[parentTask, childProject, grandchildProject],
			[childProject, grandchildProject]
		);
		expect(outcome).toEqual({ allowed: false, reason: 'descendant' });
	});

	it('テナントが異なるheaderへのドロップは禁止される', () => {
		const task = makeTask('task-1', { tenantId: 'tenant-1' });
		const otherTenantProject = makeProject('proj-other', { tenantId: 'tenant-2' });
		const outcome = computeDragMoveOutcome(task, otherTenantProject, [task, otherTenantProject], [otherTenantProject]);
		expect(outcome).toEqual({ allowed: false, reason: 'tenant-mismatch' });
	});

	it('個人アイテム（tenantId未設定）から他テナントのプロジェクトへのドロップも禁止される', () => {
		const personalTask = makeTask('task-1', { tenantId: undefined });
		const tenantProject = makeProject('proj-A', { tenantId: 'tenant-1' });
		const outcome = computeDragMoveOutcome(personalTask, tenantProject, [personalTask, tenantProject], [tenantProject]);
		expect(outcome).toEqual({ allowed: false, reason: 'tenant-mismatch' });
	});

	it('アーカイブ済みheaderへのドロップは禁止される', () => {
		const task = makeTask('task-1', { tenantId: 'tenant-1' });
		const archivedProject = makeProject('proj-archived', { tenantId: 'tenant-1', isArchived: true });
		const outcome = computeDragMoveOutcome(task, archivedProject, [task, archivedProject], [archivedProject]);
		expect(outcome).toEqual({ allowed: false, reason: 'archived' });
	});
});
