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
			'完全削除 (Delete)',
		]);
	});

	it('最後の項目のみdanger=trueである', () => {
		const actions = buildItemContextMenuActions('item-1', defaultCallbacks);
		const dangerItems = actions.filter(a => a.danger);
		expect(dangerItems).toHaveLength(1);
		expect(dangerItems[0].label).toBe('完全削除 (Delete)');
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

		actions[4].onClick(); // 完全削除
		expect(callbacks.onDelete).toHaveBeenCalledWith('item-42');
	});

	it('全てのアクションにiconが設定されている', () => {
		const actions = buildItemContextMenuActions('item-1', defaultCallbacks);
		actions.forEach(action => {
			expect(action.icon).toBeDefined();
		});
	});
});
