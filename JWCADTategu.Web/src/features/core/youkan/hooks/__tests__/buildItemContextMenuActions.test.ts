import { describe, it, expect, vi } from 'vitest';
import { buildItemContextMenuActions } from '../buildItemContextMenuActions';

describe('buildItemContextMenuActions', () => {
	const defaultCallbacks = {
		onOpenDetail: vi.fn(),
		onMakeProject: vi.fn(),
		onResolveYes: vi.fn(),
		onResolveNo: vi.fn(),
		onDelete: vi.fn(),
	};

	it('5つのメニュー項目を返す', () => {
		const actions = buildItemContextMenuActions('item-1', defaultCallbacks);
		expect(actions).toHaveLength(5);
	});

	it('正しいラベル順で返す', () => {
		const actions = buildItemContextMenuActions('item-1', defaultCallbacks);
		expect(actions.map(a => a.label)).toEqual([
			'詳細 / 名前変更',
			'プロジェクト化',
			'今日やる (Done Today)',
			'断る (Rejected)',
			'ゴミ箱 (Del)',
		]);
	});

	it('最後の項目のみdanger=trueである', () => {
		const actions = buildItemContextMenuActions('item-1', defaultCallbacks);
		const dangerItems = actions.filter(a => a.danger);
		expect(dangerItems).toHaveLength(1);
		expect(dangerItems[0].label).toBe('ゴミ箱 (Del)');
	});

	it('各アクションが対応するコールバックを呼ぶ', () => {
		const callbacks = {
			onOpenDetail: vi.fn(),
			onMakeProject: vi.fn(),
			onResolveYes: vi.fn(),
			onResolveNo: vi.fn(),
			onDelete: vi.fn(),
		};
		const actions = buildItemContextMenuActions('item-42', callbacks);

		actions[0].onClick(); // 詳細
		expect(callbacks.onOpenDetail).toHaveBeenCalledWith('item-42');

		actions[1].onClick(); // プロジェクト化
		expect(callbacks.onMakeProject).toHaveBeenCalledWith('item-42');

		actions[2].onClick(); // 今日やる
		expect(callbacks.onResolveYes).toHaveBeenCalledWith('item-42');

		actions[3].onClick(); // 断る
		expect(callbacks.onResolveNo).toHaveBeenCalledWith('item-42');

		actions[4].onClick(); // ゴミ箱
		expect(callbacks.onDelete).toHaveBeenCalledWith('item-42');
	});

	it('全てのアクションにiconが設定されている', () => {
		const actions = buildItemContextMenuActions('item-1', defaultCallbacks);
		actions.forEach(action => {
			expect(action.icon).toBeDefined();
		});
	});

	it('onInsertBefore/onInsertAfterを渡すと、a/bキーのショートカット付きで挿入項目が追加される', () => {
		const callbacks = {
			...defaultCallbacks,
			onInsertBefore: vi.fn(),
			onInsertAfter: vi.fn(),
		};
		const actions = buildItemContextMenuActions('item-1', callbacks);

		const insertBefore = actions.find(a => a.label.includes('前に挿入'));
		const insertAfter = actions.find(a => a.label.includes('後に挿入'));

		expect(insertBefore?.shortcut).toBe('a');
		expect(insertBefore?.label).toContain('(a)');
		expect(insertAfter?.shortcut).toBe('b');
		expect(insertAfter?.label).toContain('(b)');
	});

	it('前に挿入(a)/後に挿入(b)のonClickが対応するコールバックを呼ぶ', () => {
		const callbacks = {
			...defaultCallbacks,
			onInsertBefore: vi.fn(),
			onInsertAfter: vi.fn(),
		};
		const actions = buildItemContextMenuActions('item-42', callbacks);

		actions.find(a => a.label.includes('前に挿入'))!.onClick();
		expect(callbacks.onInsertBefore).toHaveBeenCalledWith('item-42');

		actions.find(a => a.label.includes('後に挿入'))!.onClick();
		expect(callbacks.onInsertAfter).toHaveBeenCalledWith('item-42');
	});
});
