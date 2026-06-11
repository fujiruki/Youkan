import { useMemo } from 'react';
import { Item } from '../../types';
import { useYoukanViewModel } from '../../viewmodels/useYoukanViewModel';
import { format } from 'date-fns';
import { buildHierarchicalList } from '../../logic/hierarchy';

export type YoukanViewModel = ReturnType<typeof useYoukanViewModel>;

export type OverviewItemWrapper =
	| { id: string; type: 'item'; item: Item; project: Item | null; depth: number; displayDate?: string | null; displayDateType?: 'due' | 'prep' | null }
	| { id: string; type: 'header'; projectId: string; projectTitle: string; project: Item; depth: number; displayDate?: string | null; displayDateType?: 'due' | 'prep' | null };

// R-048: /dependencies は起動時に呼ばないため OverviewBoard では取得しない（フロー/ガント画面のみで取得）
export const useOverviewItems = (viewModel: YoukanViewModel, activeProject?: any | null, hideCompleted: boolean = false, showSomeday: boolean = false): OverviewItemWrapper[] => {
	const {
		gdbActive,
		gdbPreparation,
		gdbIntent,
		gdbSomeday,
		gdbLog,
		allProjects: viewModelProjects,
		todayCandidates,
		todayCommits,
		executionItem
	} = viewModel;

	return useMemo(() => {
		// 1. Gather all tasks from ALL zones（someday はデフォルト除外）
		const allItemsRaw = [
			...(gdbActive || []),
			...(gdbPreparation || []),
			...(gdbIntent || []),
			...(showSomeday ? (gdbSomeday || []) : []),
			...(todayCandidates || []),
			...(todayCommits || []),
			...(executionItem ? [executionItem] : []),
			...(gdbLog || [])
		];

		// 2. Build Hierarchy using Common Logic
		// R-048: OverviewBoard では依存関係を考慮しない（フロー/ガント画面でのみ /dependencies を取得するため）
		const hierarchicalWrappers = buildHierarchicalList({
			activeProjectId: activeProject?.cloudId || (activeProject?.id ? String(activeProject.id) : null),
			allProjects: viewModelProjects,
			allItems: allItemsRaw,
			showGroups: true,
			hideCompleted,
			dependencies: [],
			noDeadlineCreatedAsc: true,
		});

		// 3. Add Overview-specific formatting (Dates)
		const getEnhancedDate = (item: Item) => {
			const due = item.due_date ? new Date(item.due_date).getTime() : Infinity;
			const prep = item.prep_date ? item.prep_date * 1000 : Infinity;

			if (due === Infinity && prep === Infinity) return { displayDate: null, displayDateType: null };

			if (due <= prep) {
				return {
					displayDate: format(new Date(item.due_date!), 'M/d'),
					displayDateType: 'due' as const
				};
			} else {
				return {
					displayDate: format(new Date(prep), 'M/d'),
					displayDateType: 'prep' as const
				};
			}
		};

		return hierarchicalWrappers.map(wrapper => {
			if (wrapper.type === 'item') {
				const dateInfo = getEnhancedDate(wrapper.item);
				return {
					...wrapper,
					...dateInfo
				} as OverviewItemWrapper;
			}
			return wrapper as OverviewItemWrapper;
		});

	}, [gdbActive, gdbPreparation, gdbIntent, gdbSomeday, gdbLog, todayCandidates, todayCommits, executionItem, viewModelProjects, activeProject, hideCompleted, showSomeday]);
};
