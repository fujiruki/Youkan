import { describe, it, expect } from 'vitest';
import { sanitizeItems } from '../sanitizeItems';
import { Item } from '../../types';

const createMockItem = (id: string, overrides: Partial<Item> = {}): Item => ({
	id,
	title: `Task ${id}`,
	status: 'inbox',
	createdAt: Date.now(),
	updatedAt: Date.now(),
	statusUpdatedAt: Date.now(),
	focusOrder: 0,
	isEngaged: false,
	weight: 1,
	interrupt: false,
	...overrides,
} as Item);

describe('sanitizeItems', () => {
	it('正常なアイテム配列はそのまま返す', () => {
		const items = [createMockItem('a'), createMockItem('b')];
		expect(sanitizeItems(items)).toHaveLength(2);
	});

	it('null要素を除去する', () => {
		const items = [createMockItem('a'), null, createMockItem('b')] as any[];
		const result = sanitizeItems(items);
		expect(result).toHaveLength(2);
		expect(result.every((i: Item) => i != null)).toBe(true);
	});

	it('undefined要素を除去する', () => {
		const items = [undefined, createMockItem('a')] as any[];
		const result = sanitizeItems(items);
		expect(result).toHaveLength(1);
	});

	it('idがnullのアイテムを除去する', () => {
		const items = [
			createMockItem('a'),
			{ ...createMockItem('b'), id: null } as any,
		];
		const result = sanitizeItems(items);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('a');
	});

	it('idがundefinedのアイテムを除去する', () => {
		const items = [
			createMockItem('a'),
			{ ...createMockItem('b'), id: undefined } as any,
		];
		const result = sanitizeItems(items);
		expect(result).toHaveLength(1);
	});

	it('idが空文字のアイテムを除去する', () => {
		const items = [
			createMockItem('a'),
			{ ...createMockItem('b'), id: '' } as any,
		];
		const result = sanitizeItems(items);
		expect(result).toHaveLength(1);
	});

	it('空配列を渡した場合は空配列を返す', () => {
		expect(sanitizeItems([])).toHaveLength(0);
	});

	it('全てnullの配列は空配列を返す', () => {
		const items = [null, null, undefined] as any[];
		expect(sanitizeItems(items)).toHaveLength(0);
	});
});
