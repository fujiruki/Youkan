import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { ProjectSettingsModal } from '../ProjectSettingsModal';

// Mock DB dependencies and Lucide icons
vi.mock('../../../../db/db', () => ({}));
vi.mock('lucide-react', () => ({
    X: () => <span data-testid="x-icon">X</span>,
    RotateCcw: () => <span>Reset</span>
}));

describe('ProjectSettingsModal', () => {
    const mockProject: any = {
        id: 123,
        name: 'Test Project',
        createdAt: new Date(),
        updatedAt: new Date(),
        settings: {
            pricePerM3: 50000,
            markup: 0.2,
            taxRate: 0.1,
            widthMargin: 20,
            lengthMargin: 50,
            thicknessMargin: 5,
            hozoLength: 30
        },
        dxfLayerConfig: {
            joineryOutline: '0-2',
            joineryFill: '0-E',
            dimensions: '8-F',
            text: '8-0',
            frame: '8-1'
        }
    };

    it('should call onDeleteProject when delete button is clicked and confirmed', () => {
        const onDeleteProject = vi.fn();
        const onArchiveProject = vi.fn(); // Mock
        const onClose = vi.fn();
        const onSave = vi.fn();

        // Confirm = true
        window.confirm = vi.fn(() => true);
        window.alert = vi.fn();

        render(
            <ProjectSettingsModal
                project={mockProject}
                isOpen={true}
                onClose={onClose}
                onSave={onSave}
                onDeleteProject={onDeleteProject}
                onArchiveProject={onArchiveProject}
            />
        );

        // 1. Switch to Management tab (Click "管理")
        const tabButton = screen.getByText('管理');
        fireEvent.click(tabButton);

        // 2. Find "プロジェクトを完全に削除する" button
        const deleteButton = screen.getByText('プロジェクトを完全に削除する');

        // 3. Click it
        fireEvent.click(deleteButton);

        // 4. Assert
        expect(window.confirm).toHaveBeenCalled();
        expect(onDeleteProject).toHaveBeenCalledWith(123);
    });

    it('should call onArchiveProject when archive button is clicked', () => {
        const onDeleteProject = vi.fn();
        const onArchiveProject = vi.fn();
        const onClose = vi.fn();
        const onSave = vi.fn();

        window.confirm = vi.fn(() => true);

        render(
            <ProjectSettingsModal
                project={mockProject}
                isOpen={true}
                onClose={onClose}
                onSave={onSave}
                onDeleteProject={onDeleteProject}
                onArchiveProject={onArchiveProject}
            />
        );

        fireEvent.click(screen.getByText('管理'));

        // Find Archive button
        const archiveButton = screen.getByText('プロジェクトをアーカイブ');
        fireEvent.click(archiveButton);

        // Assert: Should call handler (maybe with confirmation later, but for now direct or confirm)
        // Check implementation details later, assume direct for now or check confirm if implemented
        // Based on user request "write test first", implies new behavior.
        // Let's assume we want confirmation for archive too? Or just direct.
        // Current implementation is alert('Not implemented'). We will change it.
        expect(onArchiveProject).toHaveBeenCalledWith(123);
    });

    it('should NOT call onDeleteProject if cancelled', () => {
        const onDeleteProject = vi.fn();
        const onArchiveProject = vi.fn(); // Mock
        const onClose = vi.fn();
        const onSave = vi.fn();

        // Confirm = false
        window.confirm = vi.fn(() => false);

        render(
            <ProjectSettingsModal
                project={mockProject}
                isOpen={true}
                onClose={onClose}
                onSave={onSave}
                onDeleteProject={onDeleteProject}
                onArchiveProject={onArchiveProject}
            />
        );

        fireEvent.click(screen.getByText('管理'));
        fireEvent.click(screen.getByText('プロジェクトを完全に削除する'));

        expect(window.confirm).toHaveBeenCalled();
        expect(onDeleteProject).not.toHaveBeenCalled();
    });
});
