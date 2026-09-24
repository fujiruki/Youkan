import { describe, it, expect } from 'vitest';
import { isHiddenCalcOnlyItem } from '../hiddenCalcOnlyItems';
import { Item } from '../../types';

const make = (overrides: Partial<Item>): Item => ({ id: 'a', title: 't', status: 'pending', ...overrides } as Item);

describe('isHiddenCalcOnlyItem (R-0169)', () => {
	it('pending の請求は非表示対象', () => {
		expect(isHiddenCalcOnlyItem(make({ generatedTaskRole: 'invoice', status: 'pending' }))).toBe(true);
	});
	it('請求でも pending 以外（納品済み後の inbox 等）は表示対象', () => {
		expect(isHiddenCalcOnlyItem(make({ generatedTaskRole: 'invoice', status: 'inbox' }))).toBe(false);
		expect(isHiddenCalcOnlyItem(make({ generatedTaskRole: 'invoice', status: 'done' }))).toBe(false);
	});
	it('見積や通常タスクは表示対象', () => {
		expect(isHiddenCalcOnlyItem(make({ generatedTaskRole: 'estimate', status: 'pending' }))).toBe(false);
		expect(isHiddenCalcOnlyItem(make({ status: 'pending' }))).toBe(false);
	});
});
