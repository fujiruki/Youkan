import { useEffect, useMemo, useState } from 'react';
import { Dependency, Item } from '../../types';
import { useYoukanViewModel } from '../../viewmodels/useYoukanViewModel';
import { format } from 'date-fns';
import { buildHierarchicalList } from '../../logic/hierarchy';
import { buildReviewQueue } from '../../logic/reviewQueue';
import { DependencyRepository } from '../../repositories/DependencyRepository';

export type YoukanViewModel = ReturnType<typeof useYoukanViewModel>;

export type OverviewItemWrapper =
	| { id: string; type: 'item'; item: Item; project: Item | null; depth: number; displayDate?: string | null; displayDateType?: 'due' | 'prep' | null }
	| { id: string; type: 'header'; projectId: string; projectTitle: string; project: Item; depth: number; displayDate?: string | null; displayDateType?: 'due' | 'prep' | null };

// R-048: 起動時の /dependencies 多重取得を避けるため OverviewBoard では従来 dependencies: [] 固定だった。
// R-091: 依存関係順ソートを全体一覧にも展開するため、画面表示時に1回だけ取得する方針に変更（R-048を上書き）。
// items（gdbActive等）の変化のたびには再取得しない（マウント時1回のみ）。
export const useOverviewItems = (viewModel: YoukanViewModel, activeProject?: any | null, hideCompleted: boolean = false, showSomeday: boolean = false, needsReviewOnly: boolean = false): OverviewItemWrapper[] => {
	const {
		gdbActive,
		gdbTodo,
		gdbPreparation,
		gdbIntent,
		gdbSomeday,
		gdbLog,
		allProjects: viewModelProjects,
		todayCandidates,
		todayCommits,
		executionItem
	} = viewModel;

	const [dependencies, setDependencies] = useState<Dependency[]>([]);
	useEffect(() => {
		const repo = new DependencyRepository();
		repo.getDependencies().then(setDependencies).catch(() => {
			// 取得失敗時は空配列のまま（従来の並び順にフォールバック）
		});
	}, []);

	return useMemo(() => {
		// 1. Gather all tasks from ALL zones（someday はデフォルト除外）
		// R-125: todo（後日着手）は既定で表示（inboxと同じ扱い）
		const allItemsRaw = [
			...(gdbActive || []),
			...(gdbTodo || []),
			...(gdbPreparation || []),
			...(gdbIntent || []),
			...(showSomeday ? (gdbSomeday || []) : []),
			...(todayCandidates || []),
			...(todayCommits || []),
			...(executionItem ? [executionItem] : []),
			...(gdbLog || [])
		];
		const dedupedItems = Array.from(
			new Map(allItemsRaw.filter(Boolean).map(item => [String(item.id), item])).values()
		);

		// R-127: 「要判断」フィルタチップON時は buildReviewQueue の対象のみに絞る。
		// 対象・並びの定義はlogic/reviewQueue.tsに一本化し、この画面用に再実装しない
		const allItems = needsReviewOnly
			? (() => {
				const today = format(new Date(), 'yyyy-MM-dd');
				const reviewIds = new Set(buildReviewQueue(dedupedItems, today).map(i => i.id));
				return dedupedItems.filter(item => reviewIds.has(item.id));
			})()
			: dedupedItems;

		// 2. Build Hierarchy using Common Logic
		// R-091: 依存関係のあるタスクは前後の序列を崩さずに並べる
		const hierarchicalWrappers = buildHierarchicalList({
			activeProjectId: activeProject?.cloudId || (activeProject?.id ? String(activeProject.id) : null),
			allProjects: viewModelProjects,
			allItems,
			showGroups: true,
			hideCompleted,
			dependencies,
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

	}, [gdbActive, gdbPreparation, gdbIntent, gdbSomeday, gdbLog, todayCandidates, todayCommits, executionItem, viewModelProjects, activeProject, hideCompleted, showSomeday, needsReviewOnly, dependencies]);
};
