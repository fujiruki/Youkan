import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { PanoramaBoard } from '../PanoramaBoard';
import { ToastProvider } from '../../../../../../contexts/ToastContext';

/**
 * R-142: PanoramaBoard が DecisionDetailModal に allProjects を渡しておらず、
 * 所属プロジェクト欄が「Inbox（未分類）」と誤表示されるバグの回帰テスト。
 */

let capturedModalProps: any = null;
const projects = [{ id: 'proj-1', title: '石鎚山', isProject: true }];

vi.mock('../../../repositories/DependencyRepository', () => ({
    DependencyRepository: vi.fn().mockImplementation(function (this: any) {
        this.getDependencies = vi.fn().mockResolvedValue([]);
    }),
}));

vi.mock('../BucketColumn', () => ({ BucketColumn: () => null }));

vi.mock('../../../viewmodels/useYoukanViewModel', () => ({
    useYoukanViewModel: () => ({
        gdbActive: [],
        gdbTodo: [],
        gdbPreparation: [],
        gdbIntent: [],
        gdbSomeday: [],
        gdbLog: [],
        ghostGdbCount: 0,
        ghostTodayCount: 0,
        allProjects: projects,
        members: [],
        createSubTask: vi.fn(),
        memos: [],
        addSideMemo: vi.fn(),
        deleteSideMemo: vi.fn(),
        memoToInbox: vi.fn(),
        throwIn: vi.fn(),
        refreshAll: vi.fn(),
        refreshGdb: vi.fn(),
        deleteItem: vi.fn(),
        completeItem: vi.fn(),
        skipTask: vi.fn(),
        setEngaged: vi.fn(),
        resolveDecision: vi.fn(),
        createProject: vi.fn(),
        moveToSomeday: vi.fn(),
        delegateTask: vi.fn(),
        projectizeItem: vi.fn(),
        archiveItem: vi.fn(),
        updatePreparationDate: vi.fn(),
        updateItemMetrics: vi.fn(),
    }),
}));

vi.mock('../../../contexts/FilterContext', () => ({
    useFilter: () => ({ filterMode: 'all', setFilterMode: vi.fn(), hideCompleted: false, setHideCompleted: vi.fn() })
}));

vi.mock('../../../../auth/providers/AuthProvider', () => ({
    useAuth: () => ({ joinedTenants: [{ id: 'tenant-1', name: '会社A' }] })
}));

vi.mock('../../Modal/ProjectCreationDialog', () => ({ ProjectCreationDialog: () => null }));

vi.mock('../../Modal/DecisionDetailModal', () => ({
    DecisionDetailModal: (props: any) => {
        capturedModalProps = props;
        return null;
    },
}));

describe('R-142: PanoramaBoard 詳細モーダルへの joinedTenants / allProjects 受け渡し', () => {
    it('joinedTenants と allProjects が空でない配列で渡される', async () => {
        render(<ToastProvider><PanoramaBoard hideHeader={true} /></ToastProvider>);
        await waitFor(() => expect(capturedModalProps).not.toBeNull());
        expect(capturedModalProps.joinedTenants).toEqual([{ id: 'tenant-1', name: '会社A' }]);
        expect(capturedModalProps.allProjects).toEqual(projects);
    });
});
