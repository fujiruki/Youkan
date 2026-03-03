import { useMemo } from 'react';
import { Item } from '../../types';
import { useYoukanViewModel } from '../../viewmodels/useYoukanViewModel';
import { format } from 'date-fns';
import { buildHierarchicalList } from '../../logic/hierarchy';

export type YoukanViewModel = ReturnType<typeof useYoukanViewModel>;

export interface NewspaperItemWrapper {
	id: string;
	type: 'item' | 'header';
	item: Item;
	project?: Item | null; // Projects are Items in ViewModel
	depth: number;
	// [NEW] Enhanced date info
	displayDate?: string | null;     // format: 'M/d'
	displayDateType?: 'due' | 'prep' | null;
}

export const useNewspaperItems = (viewModel: YoukanViewModel, activeProject?: any | null, hideCompleted: boolean = false): NewspaperItemWrapper[] => {
	const {
		gdbActive,
		gdbPreparation,
		gdbIntent,
		gdbLog,
		allProjects: viewModelProjects,
		todayCandidates,
		todayCommits,
		executionItem
	} = viewModel;

	return useMemo(() => {
		// 1. Gather all tasks from ALL zones
		const allItemsRaw = [
			...(gdbActive || []),
			...(gdbPreparation || []),
			...(gdbIntent || []),
			...(todayCandidates || []),
			...(todayCommits || []),
			...(executionItem ? [executionItem] : []),
			...(gdbLog || [])
		];

		// 2. Build Hierarchy using Common Logic
		const hierarchicalWrappers = buildHierarchicalList({
			activeProjectId: activeProject?.cloudId || (activeProject?.id ? String(activeProject.id) : null),
			allProjects: viewModelProjects,
			allItems: allItemsRaw,
			showGroups: true,
			hideCompleted
		});

		// 3. Add Newspaper-specific formatting (Dates)
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
				} as NewspaperItemWrapper;
			}
			return wrapper as NewspaperItemWrapper;
		});

	}, [gdbActive, gdbPreparation, gdbIntent, gdbLog, todayCandidates, todayCommits, executionItem, viewModelProjects, activeProject, hideCompleted]);
};
