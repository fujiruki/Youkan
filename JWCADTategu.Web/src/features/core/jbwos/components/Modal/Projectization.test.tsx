import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DecisionDetailModal } from './DecisionDetailModal';
import { Item } from '../../types';

// Mock dependencies
const mockOnClose = vi.fn();
const mockOnDecision = vi.fn();
const mockOnDelete = vi.fn();
const mockOnUpdate = vi.fn();
const mockOnCreateSubTask = vi.fn();
const mockOnGetSubTasks = vi.fn();

const mockItem: Item = {
    id: 'item-1',
    title: 'Test Project',
    status: 'inbox',
    createdAt: 1000,
    updatedAt: 1000,
    statusUpdatedAt: 1000,
    interrupt: false,
    weight: 1,
    isProject: false // Initially false
};

describe('DecisionDetailModal Projectization', () => {
    it('renders Projectize button when item is not a project', () => {
        render(
            <DecisionDetailModal
                item={mockItem}
                onClose={mockOnClose}
                onDecision={mockOnDecision}
                onDelete={mockOnDelete}
                onUpdate={mockOnUpdate}
                onCreateSubTask={mockOnCreateSubTask}
                onGetSubTasks={mockOnGetSubTasks}
            />
        );

        // Open Menu
        fireEvent.click(screen.getByTitle('ゴミ箱・その他'));

        expect(screen.getByText('プロジェクト化 (タスク分解)')).toBeInTheDocument();
    });

    it('changes to Project mode and shows sub-tasks when Projectize is clicked', async () => {
        render(
            <DecisionDetailModal
                item={mockItem}
                onClose={mockOnClose}
                onDecision={mockOnDecision}
                onDelete={mockOnDelete}
                onUpdate={mockOnUpdate}
                onCreateSubTask={mockOnCreateSubTask}
                onGetSubTasks={mockOnGetSubTasks}
            />
        );

        fireEvent.click(screen.getByTitle('ゴミ箱・その他'));
        const projectizeBtn = screen.getByText('プロジェクト化 (タスク分解)');
        fireEvent.click(projectizeBtn);

        await waitFor(() => {
            expect(screen.getByText('サブタスク (Project)')).toBeInTheDocument();
        });

        expect(mockOnUpdate).toHaveBeenCalledWith(mockItem.id, { isProject: true });

        // Since we mock, we can't see the internal state change unless we rerender or simple trust updating `isProject`.
        // But the component uses local state synced from prop using useEffect.
        // It updates itself locally in `onClick` as well: `setIsProject(true);`
    });

    it('displays sub-tasks and allows adding new one', async () => {
        const projectItem = { ...mockItem, isProject: true };
        const subTasks = [
            { id: 'sub-1', title: 'Sub Task 1', status: 'inbox' } as Item
        ];

        mockOnGetSubTasks.mockResolvedValue(subTasks);

        render(
            <DecisionDetailModal
                item={projectItem}
                onClose={mockOnClose}
                onDecision={mockOnDecision}
                onDelete={mockOnDelete}
                onUpdate={mockOnUpdate}
                onCreateSubTask={mockOnCreateSubTask}
                onGetSubTasks={mockOnGetSubTasks}
            />
        );

        // Check load
        await waitFor(() => {
            expect(screen.getByText('Sub Task 1')).toBeInTheDocument();
        });

        // Add New
        const input = screen.getByPlaceholderText('サブタスクを追加...');
        fireEvent.change(input, { target: { value: 'New Sub Task' } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

        await waitFor(() => {
            expect(mockOnCreateSubTask).toHaveBeenCalledWith(projectItem.id, 'New Sub Task');
        });
    });
});
