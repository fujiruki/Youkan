import { describe, it, expect } from 'vitest';
import { resolveRootProjectId } from '../hierarchy';
import { Item } from '../../types';

/**
 * R-155: ドロップ先ノードから見た「ルート案件ID」を返すヘルパー。
 * buildHierarchicalList の親子解決（parent_id優先・project_idフォールバック）と
 * 完全に同じ優先順位で allProjects を遡る。
 */

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

describe('resolveRootProjectId（R-155）', () => {
	it('ルートプロジェクト自身を渡すと、そのまま自分のIDを返す', () => {
		const root = makeProject('root-1');
		expect(resolveRootProjectId('root-1', [root])).toBe('root-1');
	});

	it('サブプロジェクト（parentId経由）から、ルートプロジェクトIDを遡って返す', () => {
		const root = makeProject('root-1');
		const sub = makeProject('sub-1', { parentId: 'root-1' });
		expect(resolveRootProjectId('sub-1', [root, sub])).toBe('root-1');
	});

	it('多段階のサブプロジェクトでも最上位のルートIDまで遡る', () => {
		const root = makeProject('root-1');
		const sub1 = makeProject('sub-1', { parentId: 'root-1' });
		const sub2 = makeProject('sub-2', { parentId: 'sub-1' });
		expect(resolveRootProjectId('sub-2', [root, sub1, sub2])).toBe('root-1');
	});

	it('Beaver work_package（parentId=null, projectId=ルートID）はprojectIdへフォールバックしてルートIDを返す（探索不要ケース）', () => {
		const root = makeProject('beaver-root');
		const workPackage = makeProject('wp-1', { parentId: null, projectId: 'beaver-root' });
		expect(resolveRootProjectId('wp-1', [root, workPackage])).toBe('beaver-root');
	});

	it('parentIdが未知のIDを指す場合はprojectIdへフォールタックしない優先順位を守りつつ、自分自身を返す（存在しないparentは無視）', () => {
		const orphanSub = makeProject('orphan-1', { parentId: 'unknown-id', projectId: null });
		expect(resolveRootProjectId('orphan-1', [orphanSub])).toBe('orphan-1');
	});

	it('parentIdが自分自身を指す循環参照でも無限ループしない', () => {
		const selfLoop = makeProject('loop-1', { parentId: 'loop-1' });
		expect(resolveRootProjectId('loop-1', [selfLoop])).toBe('loop-1');
	});

	it('相互循環参照（A→B→A）でも無限ループしない', () => {
		const a = makeProject('a', { parentId: 'b' });
		const b = makeProject('b', { parentId: 'a' });
		expect(() => resolveRootProjectId('a', [a, b])).not.toThrow();
	});

	it('allProjectsに存在しないnodeIdを渡した場合はそのまま返す（防御的フォールバック）', () => {
		expect(resolveRootProjectId('missing-id', [])).toBe('missing-id');
	});

	it('projectIdが自分自身を指す場合は自己参照として扱わずルートとみなす', () => {
		const selfRefRoot = makeProject('root-2', { projectId: 'root-2' });
		expect(resolveRootProjectId('root-2', [selfRefRoot])).toBe('root-2');
	});
});
