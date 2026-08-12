import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { PanoramaBoard } from '../PanoramaBoard';
import type { Dependency } from '../../../types';
import { ToastProvider } from '../../../../../../contexts/ToastContext';

/**
 * R-091: 状況把握（PanoramaBoard）でも依存関係のあるタスクの前後の序列を崩さずに並べる。
 *
 * BucketColumn側の並び替えロジックは hierarchy.test.ts で検証済みのため、
 * ここでは PanoramaBoard が /dependencies を画面表示時に1回だけ取得し、
 * BucketColumn へ正しく渡していることを確認する。
 */

const mockGetDependencies = vi.fn();
const capturedDependenciesProps: (Dependency[] | undefined)[] = [];

vi.mock('../../../repositories/DependencyRepository', () => ({
    DependencyRepository: vi.fn().mockImplementation(function (this: any) {
        this.getDependencies = mockGetDependencies;
    }),
}));

vi.mock('../BucketColumn', () => ({
    BucketColumn: (props: any) => {
        capturedDependenciesProps.push(props.dependencies);
        return (
            <div data-testid="bucket-column">
                {props.items?.map((item: any) => <div key={item.id}>{item.title}</div>)}
            </div>
        );
    }
}));

vi.mock('../../../viewmodels/useYoukanViewModel', () => ({
    useYoukanViewModel: () => ({
        gdbActive: [],
        gdbPreparation: [],
        gdbIntent: [],
        gdbSomeday: [],
        gdbLog: [],
        ghostGdbCount: 0,
        ghostTodayCount: 0,
        allProjects: [],
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
    useAuth: () => ({ joinedTenants: [] })
}));

// PanoramaBoard自体のロジックに無関係なモーダル（別途ネットワークhookを持つ）はスタブ化する
vi.mock('../../Modal/ProjectCreationDialog', () => ({
    ProjectCreationDialog: () => null,
}));

vi.mock('../../Modal/DecisionDetailModal', () => ({
    DecisionDetailModal: () => null,
}));

describe('R-091: PanoramaBoard 依存関係データの取得と反映', () => {
    beforeEach(() => {
        mockGetDependencies.mockReset();
        mockGetDependencies.mockResolvedValue([]);
        capturedDependenciesProps.length = 0;
    });

    it('マウント時に getDependencies が1回だけ呼ばれ、各BucketColumnへ渡される', async () => {
        const deps: Dependency[] = [
            { id: 'dep-1', sourceItemId: 'pred', targetItemId: 'succ', createdAt: 0 },
        ];
        mockGetDependencies.mockResolvedValue(deps);

        render(<ToastProvider><PanoramaBoard hideHeader={true} /></ToastProvider>);

        await waitFor(() => expect(mockGetDependencies).toHaveBeenCalledTimes(1));
        // 初回レンダリングはfetch解決前のため空配列。fetch解決後の再レンダリングで
        // 実際のdepsが渡っていることを確認する（最終的に渡された値のみを見る）
        await waitFor(() => {
            expect(capturedDependenciesProps).toContain(deps);
        });
    });
});
