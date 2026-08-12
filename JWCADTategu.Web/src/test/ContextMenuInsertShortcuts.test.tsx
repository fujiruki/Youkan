import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { ContextMenu } from '../features/core/youkan/components/Common/ContextMenu';
import { buildItemContextMenuActions } from '../features/core/youkan/hooks/buildItemContextMenuActions';
import { vi, describe, it, expect } from 'vitest';

describe('ContextMenu 前に挿入/後に挿入 ショートカット', () => {
	const setup = () => {
		const onInsertBefore = vi.fn();
		const onInsertAfter = vi.fn();
		const onClose = vi.fn();
		const actions = buildItemContextMenuActions('test-item', {
			onOpenDetail: vi.fn(),
			onMakeProject: vi.fn(),
			onResolveYes: vi.fn(),
			onResolveNo: vi.fn(),
			onDelete: vi.fn(),
			onInsertBefore,
			onInsertAfter,
		});

		render(
			<ContextMenu
				x={100}
				y={100}
				itemId="test-item"
				onClose={onClose}
				actions={actions}
			/>
		);

		return { onInsertBefore, onInsertAfter, onClose };
	};

	it('メニュー表示中にaキーを押すとonInsertBeforeが呼ばれ、メニューが閉じる', () => {
		const { onInsertBefore, onInsertAfter, onClose } = setup();

		expect(screen.getByText(/前に挿入/)).toBeTruthy();

		fireEvent.keyDown(document, { key: 'a' });

		expect(onInsertBefore).toHaveBeenCalledWith('test-item');
		expect(onInsertAfter).not.toHaveBeenCalled();
		expect(onClose).toHaveBeenCalled();
	});

	it('メニュー表示中にbキーを押すとonInsertAfterが呼ばれ、メニューが閉じる', () => {
		const { onInsertBefore, onInsertAfter, onClose } = setup();

		expect(screen.getByText(/後に挿入/)).toBeTruthy();

		fireEvent.keyDown(document, { key: 'b' });

		expect(onInsertAfter).toHaveBeenCalledWith('test-item');
		expect(onInsertBefore).not.toHaveBeenCalled();
		expect(onClose).toHaveBeenCalled();
	});

	it('前に挿入/後に挿入のラベルに(a)/(b)が表示される', () => {
		setup();

		expect(screen.getByText(/前に挿入.*\(a\)/)).toBeTruthy();
		expect(screen.getByText(/後に挿入.*\(b\)/)).toBeTruthy();
	});
});
