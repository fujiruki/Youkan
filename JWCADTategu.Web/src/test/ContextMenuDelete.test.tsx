import { render, screen, fireEvent } from '@testing-library/react';
import { ContextMenu } from '../features/jbwos/components/GlobalBoard/ContextMenu';
import { vi, describe, it, expect } from 'vitest';

describe('ContextMenu Delete Shortcut', () => {
    it('Delキーを押すとonDeleteが呼ばれ、onCloseも呼ばれる', () => {
        const mockOnDelete = vi.fn();
        const mockOnClose = vi.fn();
        const mockOnEdit = vi.fn();

        // ContextMenuを表示
        render(
            <ContextMenu
                x={100}
                y={100}
                itemId="test-item-delete"
                onClose={mockOnClose}
                onDelete={mockOnDelete}
                onEdit={mockOnEdit}
            />
        );

        // コンテキストメニューが表示されていることを確認（削除ボタンがあるか）
        const deleteButton = screen.getByText(/削除/);
        expect(deleteButton).toBeTruthy();

        // Deleteキー押下 (windowに対してだと拾われない場合があるためdocumentへ)
        fireEvent.keyDown(document, { key: 'Delete' });

        // 検証
        expect(mockOnDelete).toHaveBeenCalledWith('test-item-delete');
        expect(mockOnClose).toHaveBeenCalled();
    });
});
