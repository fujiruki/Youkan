import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SortableFocusQueue } from '../SortableFocusQueue';
import { Item } from '../../../types';

const makeItem = (overrides: Partial<Item> = {}): Item => ({
	id: 'item-1',
	title: 'Test Task',
	status: 'focus',
	tenantId: 'test-tenant',
	created_at: '2026-01-01',
	updated_at: '2026-01-01',
	...overrides,
});

const defaultProps = {
	items: [makeItem({ id: 'item-1', title: 'Task 1' }), makeItem({ id: 'item-2', title: 'Task 2' })],
	onReorder: vi.fn(),
	onItemClick: vi.fn(),
	onContextMenu: vi.fn(),
	onFocus: vi.fn(),
};

describe('SortableFocusQueue', () => {
	it('カード全体にドラッグ属性が付与されている', () => {
		render(<SortableFocusQueue {...defaultProps} />);

		const cards = screen.getAllByTestId('sortable-card');
		expect(cards).toHaveLength(2);

		cards.forEach((card) => {
			expect(card).toHaveAttribute('role', 'button');
			expect(card).toHaveAttribute('tabindex');
		});
	});

	it('グリップアイコンが表示されている', () => {
		render(<SortableFocusQueue {...defaultProps} />);

		const grips = screen.getAllByTestId('drag-handle');
		expect(grips).toHaveLength(2);
	});

	it('グリップアイコンにはドラッグlistenersが付与されていない（カード全体に移動済み）', () => {
		render(<SortableFocusQueue {...defaultProps} />);

		const grips = screen.getAllByTestId('drag-handle');
		grips.forEach((grip) => {
			expect(grip).not.toHaveAttribute('role', 'button');
		});
	});
});
